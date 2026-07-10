package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"code-pdm/models"
	"code-pdm/utils"

	"github.com/gin-gonic/gin"
)

// GetDevices 获取设备列表（支持关联 DeviceType，并支持模糊筛选）
func GetDevices(c *gin.Context) {
	var list []models.Device
	query := models.DB.Preload("DeviceType").Model(&models.Device{})

	// 模糊匹配设备名称
	name := c.Query("name")
	if name != "" {
		query = query.Where("devices.name LIKE ?", "%"+name+"%")
	}

	// 模糊/精确匹配设备ID
	deviceID := c.Query("device_id")
	if deviceID != "" {
		query = query.Where("devices.device_id LIKE ?", "%"+deviceID+"%")
	}

	// 过滤特定设备类型
	typeID := c.Query("device_type_id")
	if typeID != "" {
		dtID, err := strconv.Atoi(typeID)
		if err == nil {
			query = query.Where("devices.device_type_id = ?", dtID)
		}
	}

	if err := query.Order("devices.id desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备列表失败"})
		return
	}

	c.JSON(http.StatusOK, list)
}

// GetDevice 获取单个设备详情
func GetDevice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法的 ID 格式"})
		return
	}

	var dev models.Device
	if err := models.DB.Preload("DeviceType").First(&dev, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "设备不存在"})
		return
	}

	c.JSON(http.StatusOK, dev)
}

// CreateDevice 创建设备（由前端提供已生成的四位唯一后缀）
func CreateDevice(c *gin.Context) {
	var req struct {
		Letter       string `json:"letter"`                    // 可选前缀字段（优先以设备类型对应的 Letter 为准）
		Number       string `json:"number" binding:"required"` // 前端指定的四位唯一后缀
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		Date         string `json:"date"` // YYYY-MM-DD
		DeviceTypeID uint   `json:"device_type_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写必要字段（数字后缀、名称、设备类型）"})
		return
	}

	// 1. 验证设备类型是否存在
	var dt models.DeviceType
	if err := models.DB.First(&dt, req.DeviceTypeID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "所选设备类型不存在"})
		return
	}

	// 2. 验证并规范化首字母（取关联设备类型的 Letter）
	prefix, err := utils.FormatLetter(dt.Letter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "设备类型首字母格式无效: " + err.Error()})
		return
	}

	// 3. 验证后缀数字格式
	suffix := strings.TrimSpace(req.Number)
	if len(suffix) != 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "数字后缀必须为 4 位"})
		return
	}
	for _, r := range suffix {
		if r < '0' || r > '9' {
			c.JSON(http.StatusBadRequest, gin.H{"error": "数字后缀必须全为数字(0-9)"})
			return
		}
	}

	// 4. 处理登记日期，若为空默认为当天
	dateStr := strings.TrimSpace(req.Date)
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	} else {
		if _, err := time.Parse("2006-01-02", dateStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "登记日期格式无效，请使用 YYYY-MM-DD 格式"})
			return
		}
	}

	// 5. 校验数据库查重
	var count int64
	if err := models.DB.Model(&models.Device{}).Where("number = ?", suffix).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证数字唯一性失败"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "此四位数字后缀已被其他设备占用，请点击重新生成"})
		return
	}

	// 6. 创建设备
	dev := models.Device{
		Letter:       prefix,
		Number:       suffix,
		DeviceID:     prefix + suffix,
		Name:         strings.TrimSpace(req.Name),
		Description:  strings.TrimSpace(req.Description),
		Date:         dateStr,
		DeviceTypeID: req.DeviceTypeID,
	}

	if err := models.DB.Create(&dev).Error; err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, gin.H{"error": "该设备后缀由于并发已被抢占，请点击重新生成并提交"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存设备失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dev)
}

// GenerateSuffix 生成一个当前全局未使用的、随机的 4 位数字后缀 (0000-9999)
func GenerateSuffix(c *gin.Context) {
	suffix, err := utils.GenerateUniqueNumber(models.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成唯一后缀失败: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"suffix": suffix})
}

// UpdateDevice 修改设备（仅允许修改描述性字段，不允许修改物理分配的设备ID后缀）
func UpdateDevice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法的 ID 格式"})
		return
	}

	var dev models.Device
	if err := models.DB.First(&dev, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "设备不存在"})
		return
	}

	var req struct {
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		Date         string `json:"date"`
		DeviceTypeID uint   `json:"device_type_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写必要字段"})
		return
	}

	// 验证新指定的设备类型是否存在
	var dt models.DeviceType
	if err := models.DB.First(&dt, req.DeviceTypeID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "所选设备类型不存在"})
		return
	}

	// 验证并格式化日期
	dateStr := strings.TrimSpace(req.Date)
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	} else {
		if _, err := time.Parse("2006-01-02", dateStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "登记日期格式无效，请使用 YYYY-MM-DD 格式"})
			return
		}
	}

	// 仅更新描述性及分类信息，不改变硬件编码 Letter 和 Number 后缀
	dev.Name = strings.TrimSpace(req.Name)
	dev.Description = strings.TrimSpace(req.Description)
	dev.Date = dateStr
	dev.DeviceTypeID = req.DeviceTypeID

	if err := models.DB.Save(&dev).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新设备失败"})
		return
	}

	c.JSON(http.StatusOK, dev)
}

// DeleteDevice 删除设备
func DeleteDevice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法的 ID 格式"})
		return
	}

	var dev models.Device
	if err := models.DB.First(&dev, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "设备不存在"})
		return
	}

	if err := models.DB.Delete(&dev).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除设备失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "设备删除成功"})
}


