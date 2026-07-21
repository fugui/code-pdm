package handlers

import (
	"fmt"
	"net/http"
	"time"

	"code-pdm/models"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// ExportAllExcel 将设备型号和设备ID统一导出为一个 xlsx 文件（双 Sheet）
func ExportAllExcel(c *gin.Context) {
	// 1. 查询所有设备类型
	var deviceTypes []models.DeviceType
	if err := models.DB.Order("id desc").Find(&deviceTypes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备类型导出数据失败"})
		return
	}

	// 2. 查询所有设备列表
	var devices []models.Device
	if err := models.DB.Preload("DeviceType").Order("id desc").Find(&devices).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备导出数据失败"})
		return
	}

	// 3. 创建 excelize 文件
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			// 仅记录日志
		}
	}()

	// 样式定义：表头字体加粗，带有淡淡的背景灰
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Color: "000000", Size: 11},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"EAEAEA"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建 Excel 样式失败: " + err.Error()})
		return
	}

	// --- Sheet 1: 设备型号 ---
	sheetTypes := "设备型号"
	// 新建 Sheet
	index1, err := f.NewSheet(sheetTypes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建 Excel 工作表失败: " + err.Error()})
		return
	}

	// 写入表头
	headersTypes := []string{"序号", "设备型号 (Machine Type)", "设备大类名称", "详细说明/备注", "创建时间"}
	for colIdx, name := range headersTypes {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheetTypes, cell, name)
	}
	// 设置表头样式
	f.SetRowStyle(sheetTypes, 1, 1, headerStyle)
	f.SetRowHeight(sheetTypes, 1, 25)

	// 写入数据
	for rIdx, dt := range deviceTypes {
		row := rIdx + 2
		f.SetCellValue(sheetTypes, fmt.Sprintf("A%d", row), rIdx+1)
		f.SetCellValue(sheetTypes, fmt.Sprintf("B%d", row), dt.Model)
		f.SetCellValue(sheetTypes, fmt.Sprintf("C%d", row), dt.Name)
		f.SetCellValue(sheetTypes, fmt.Sprintf("D%d", row), dt.Description)
		f.SetCellValue(sheetTypes, fmt.Sprintf("E%d", row), dt.CreatedAt.Format("2006-01-02 15:04:05"))
		f.SetRowHeight(sheetTypes, row, 20)
	}

	// --- Sheet 2: 设备ID ---
	sheetDevices := "设备ID"
	index2, err := f.NewSheet(sheetDevices)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建 Excel 工作表失败: " + err.Error()})
		return
	}

	// 写入表头
	headersDevices := []string{"序号", "设备 ID (标识符)", "前缀字母", "后缀数字", "设备实体名称", "所属设备大类名称", "设备大类主型号", "登记日期", "详细备注/说明", "创建时间"}
	for colIdx, name := range headersDevices {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheetDevices, cell, name)
	}
	f.SetRowStyle(sheetDevices, 1, 1, headerStyle)
	f.SetRowHeight(sheetDevices, 1, 25)

	// 写入数据
	for rIdx, d := range devices {
		row := rIdx + 2
		typeName := "未分类"
		typeModel := "未知"
		if d.DeviceType.ID != 0 {
			typeName = d.DeviceType.Name
			typeModel = d.DeviceType.Model
		}

		f.SetCellValue(sheetDevices, fmt.Sprintf("A%d", row), rIdx+1)
		f.SetCellValue(sheetDevices, fmt.Sprintf("B%d", row), d.DeviceID)
		f.SetCellValue(sheetDevices, fmt.Sprintf("C%d", row), d.Letter)
		f.SetCellValue(sheetDevices, fmt.Sprintf("D%d", row), d.Number)
		f.SetCellValue(sheetDevices, fmt.Sprintf("E%d", row), d.Name)
		f.SetCellValue(sheetDevices, fmt.Sprintf("F%d", row), typeName)
		f.SetCellValue(sheetDevices, fmt.Sprintf("G%d", row), typeModel)
		f.SetCellValue(sheetDevices, fmt.Sprintf("H%d", row), d.Date)
		f.SetCellValue(sheetDevices, fmt.Sprintf("I%d", row), d.Description)
		f.SetCellValue(sheetDevices, fmt.Sprintf("J%d", row), d.CreatedAt.Format("2006-01-02 15:04:05"))
		f.SetRowHeight(sheetDevices, row, 20)
	}

	// 删除新建文件时默认创建的 "Sheet1"
	f.DeleteSheet("Sheet1")

	// 设置默认活跃工作表
	f.SetActiveSheet(index1)
	_ = index2 // 抑制未使用 warning

	// 自动设置合适的列宽
	adjustColWidth(f, sheetTypes, len(headersTypes))
	adjustColWidth(f, sheetDevices, len(headersDevices))

	// 设置 HTTP Header，文件名格式：pdm_export_YYYY-MM-DD.xlsx
	filename := fmt.Sprintf("pdm_export_%s.xlsx", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "导出 Excel 文件写入失败: " + err.Error()})
		return
	}
}

// adjustColWidth 自动调节列宽
func adjustColWidth(f *excelize.File, sheetName string, colCount int) {
	for colIdx := 1; colIdx <= colCount; colIdx++ {
		colName, _ := excelize.ColumnNumberToName(colIdx)
		cols, _ := f.GetCols(sheetName)
		if len(cols) < colIdx {
			continue
		}
		maxLen := 10 // 设定最小宽度为 10
		for _, val := range cols[colIdx-1] {
			// 中文字符在 ASCII 码上占的物理宽度更多，加权计算
			actualLen := 0
			for _, r := range val {
				if r > 127 {
					actualLen += 2 // 中文字符算2
				} else {
					actualLen += 1 // 英文/数字算1
				}
			}
			if actualLen > maxLen {
				maxLen = actualLen
			}
		}
		// 加上适量边距
		_ = f.SetColWidth(sheetName, colName, colName, float64(maxLen+3))
	}
}
