package handlers

import (
	"encoding/csv"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"code-pdm/models"

	"github.com/gin-gonic/gin"
)

// Regex 校验规则：1到2个字母 + 可选冒号 + 数字
var modelRegex = regexp.MustCompile(`^[a-zA-Z]{1,2}:?[0-9]+$`)

// GetDeviceTypes 获取设备类型列表
func GetDeviceTypes(c *gin.Context) {
	var list []models.DeviceType
	query := models.DB.Model(&models.DeviceType{})

	// 模糊匹配查询名称
	name := c.Query("name")
	if name != "" {
		query = query.Where("name LIKE ?", "%"+name+"%")
	}

	// 模糊匹配型号
	model := c.Query("model")
	if model != "" {
		query = query.Where("model LIKE ?", "%"+model+"%")
	}

	if err := query.Order("id desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备类型失败"})
		return
	}

	c.JSON(http.StatusOK, list)
}

// GetDeviceType 获取单个设备类型详情
func GetDeviceType(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法的 ID 格式"})
		return
	}

	var dt models.DeviceType
	if err := models.DB.First(&dt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "设备类型不存在"})
		return
	}

	c.JSON(http.StatusOK, dt)
}

// CreateDeviceType 创建设备类型
func CreateDeviceType(c *gin.Context) {
	var req struct {
		Model       string `json:"model" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写必要字段"})
		return
	}

	// 正则格式校验
	req.Model = strings.TrimSpace(req.Model)
	if !modelRegex.MatchString(req.Model) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "型号格式无效。规范为：1至2位英文字母 + 任意位数字，中间可含半角冒号（例如: A100, BC888, A:90, BC:123）"})
		return
	}

	// 唯一性冲突判定
	var existing models.DeviceType
	if err := models.DB.Where("model = ?", req.Model).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该型号设备类型已存在，无法重复创建"})
		return
	}

	dt := models.DeviceType{
		Model:       req.Model,
		Name:        strings.TrimSpace(req.Name),
		Description: strings.TrimSpace(req.Description),
	}

	if err := models.DB.Create(&dt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建设备类型失败"})
		return
	}

	c.JSON(http.StatusCreated, dt)
}

// UpdateDeviceType 修改设备类型
func UpdateDeviceType(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法的 ID 格式"})
		return
	}

	var dt models.DeviceType
	if err := models.DB.First(&dt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "设备类型不存在"})
		return
	}

	var req struct {
		Model       string `json:"model" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请填写必要字段"})
		return
	}

	req.Model = strings.TrimSpace(req.Model)
	if !modelRegex.MatchString(req.Model) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "型号格式无效。规范为：1至2位英文字母 + 任意位数字，中间可含半角冒号（例如: A100, BC888, A:90, BC:123）"})
		return
	}

	// 排除自身重名判定
	var existing models.DeviceType
	if err := models.DB.Where("model = ? AND id != ?", req.Model, id).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该型号已被其他设备类型占用"})
		return
	}

	dt.Model = req.Model
	dt.Name = strings.TrimSpace(req.Name)
	dt.Description = strings.TrimSpace(req.Description)

	if err := models.DB.Save(&dt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改设备类型失败"})
		return
	}

	c.JSON(http.StatusOK, dt)
}

// DeleteDeviceType 删除设备类型
func DeleteDeviceType(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "非法的 ID 格式"})
		return
	}

	var dt models.DeviceType
	if err := models.DB.First(&dt, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "设备类型不存在"})
		return
	}

	// 强外键引用检查
	var deviceCount int64
	if err := models.DB.Model(&models.Device{}).Where("device_type_id = ?", id).Count(&deviceCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证设备依赖失败"})
		return
	}

	if deviceCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "该设备类型下存在已注册的设备实体，禁止删除。请先删除或重分类相关设备。"})
		return
	}

	if err := models.DB.Delete(&dt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除设备类型失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// ExportDeviceTypes 导出所有设备类型为 CSV 格式 (Excel 兼容)
func ExportDeviceTypes(c *gin.Context) {
	var list []models.DeviceType
	if err := models.DB.Order("id desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备类型导出数据失败"})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=machine_types.csv")

	// 写入 UTF-8 BOM 使得 Excel 打开时不出现乱码
	c.Writer.Write([]byte{0xEF, 0xBB, 0xBF})

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// 写入表头
	writer.Write([]string{"序号", "设备型号 (Model)", "设备大类名称", "详细说明/备注", "创建时间"})

	for _, dt := range list {
		writer.Write([]string{
			strconv.Itoa(int(dt.ID)),
			dt.Model,
			dt.Name,
			dt.Description,
			dt.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
}
