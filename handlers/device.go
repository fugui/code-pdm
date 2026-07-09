package handlers

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"code-pdm/models"
	"code-pdm/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
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

// CreateDevice 创建设备（核心：生成全局唯一的四位随机后缀，附带事务碰撞重试）
func CreateDevice(c *gin.Context) {
	var req struct {
		Letter       string `json:"letter" binding:"required"` // 单字母前缀
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		Date         string `json:"date"` // YYYY-MM-DD
		DeviceTypeID uint   `json:"device_type_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写必要字段（前缀字母、名称、设备类型）"})
		return
	}

	// 1. 验证并规范化首字母
	prefix, err := utils.FormatLetter(req.Letter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 2. 验证设备类型是否存在
	var dt models.DeviceType
	if err := models.DB.First(&dt, req.DeviceTypeID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "所选设备类型不存在"})
		return
	}

	// 3. 处理登记日期，若为空默认为当天
	dateStr := strings.TrimSpace(req.Date)
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	} else {
		// 简单格式验证
		if _, err := time.Parse("2006-01-02", dateStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "登记日期格式无效，请使用 YYYY-MM-DD 格式"})
			return
		}
	}

	// 4. 重试循环创建记录以抗击并发唯一索引冲突
	var savedDevice models.Device
	maxRetries := 10
	success := false

	for attempt := 0; attempt < maxRetries; attempt++ {
		// 在事务中写入
		err = models.DB.Transaction(func(tx *gorm.DB) error {
			// 生成当时唯一的四位数字
			suffix, genErr := utils.GenerateUniqueNumber(tx)
			if genErr != nil {
				return genErr
			}

			dev := models.Device{
				Letter:       prefix,
				Number:       suffix,
				DeviceID:     prefix + suffix,
				Name:         strings.TrimSpace(req.Name),
				Description:  strings.TrimSpace(req.Description),
				Date:         dateStr,
				DeviceTypeID: req.DeviceTypeID,
			}

			// 尝试写入
			if insertErr := tx.Create(&dev).Error; insertErr != nil {
				return insertErr
			}

			savedDevice = dev
			return nil
		})

		if err == nil {
			success = true
			break
		}

		// 检查是否是由于唯一约束冲突导致，如果是则继续重试，否则立即退出
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "unique") {
			// 并发碰撞，重新生成后缀并保存
			continue
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存设备失败: " + err.Error()})
			return
		}
	}

	if !success {
		c.JSON(http.StatusConflict, gin.H{"error": "设备ID后缀生成冲突，重试上限已满。请稍后再试。"})
		return
	}

	c.JSON(http.StatusCreated, savedDevice)
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

// ExportDevices 导出设备列表为 CSV 格式 (Excel 兼容)
func ExportDevices(c *gin.Context) {
	var list []models.Device
	// 关联查询设备类型
	if err := models.DB.Preload("DeviceType").Order("id desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备导出数据失败"})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=devices.csv")

	// 写入 UTF-8 BOM 使得 Excel 直接打开不会出现中文乱码
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// 写入表头
	writer.Write([]string{"内部序号 ID", "设备 ID (标识符)", "前缀字母", "后缀数字", "设备实体名称", "所属大类名称", "可见大类主型号", "登记/出厂日期", "详细备注/说明", "创建时间"})

	for _, d := range list {
		typeName := "未分类"
		typeModel := "未知"
		if d.DeviceType.ID != 0 {
			typeName = d.DeviceType.Name
			typeModel = d.DeviceType.Model
		}

		writer.Write([]string{
			strconv.Itoa(int(d.ID)),
			d.DeviceID,
			d.Letter,
			d.Number,
			d.Name,
			typeName,
			typeModel,
			d.Date,
			d.Description,
			d.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
}
