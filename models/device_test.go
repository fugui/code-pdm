package models

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"code-pdm/utils"

	"gorm.io/gorm"
)

func TestDeviceIDConcurrencySafety(t *testing.T) {
	// 1. 初始化临时测试配置
	InitDB()

	// 清空历史数据并创建一条设备类型
	DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Device{})
	DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&DeviceType{})

	dt := DeviceType{
		Model:       "T:1",
		Letter:      "T",
		Name:        "测试大类",
		Description: "并发测试专用设备大类",
	}
	if err := DB.Create(&dt).Error; err != nil {
		t.Fatalf("failed to create DeviceType: %v", err)
	}

	// 2. 并发地创建设备，触发 4 位后缀随机生成逻辑
	numGoroutines := 10
	devicesPerGoroutine := 10
	var wg sync.WaitGroup

	t.Logf("并发启动 %d 个协程，每个写入 %d 个设备...", numGoroutines, devicesPerGoroutine)

	for g := 0; g < numGoroutines; g++ {
		wg.Add(1)
		go func(gId int) {
			defer wg.Done()
			for i := 0; i < devicesPerGoroutine; i++ {
				// 并发重试逻辑，模拟 CreateDevice handler 内部的重试逻辑
				maxRetries := 10
				success := false

				for attempt := 0; attempt < maxRetries; attempt++ {
					err := DB.Transaction(func(tx *gorm.DB) error {
						suffix, err := utils.GenerateUniqueNumber(tx)
						if err != nil {
							return err
						}

						dev := Device{
							Letter:       "T",
							Number:       suffix,
							DeviceID:     "T" + suffix,
							Name:         fmt.Sprintf("设备-%d-%d", gId, i),
							Description:  "并发测试描述",
							Date:         time.Now().Format("2006-01-02"),
							DeviceTypeID: dt.ID,
						}

						if err := tx.Create(&dev).Error; err != nil {
							return err
						}
						return nil
					})

					if err == nil {
						success = true
						break
					}
					// 如果是并发主键/唯一索引冲突，进入下一次重试循环
				}

				if !success {
					t.Errorf("协程 %d 写入设备 %d 失败，重试已达上限", gId, i)
				}
			}
		}(g)
	}

	wg.Wait()

	// 3. 校验数据库中的结果
	var count int64
	DB.Model(&Device{}).Count(&count)
	expected := int64(numGoroutines * devicesPerGoroutine)
	if count != expected {
		t.Errorf("期望写入设备总数 %d，但实际写入了 %d", expected, count)
	}

	// 检查所有的 Number 后缀是否有重复
	var allDevices []Device
	if err := DB.Find(&allDevices).Error; err != nil {
		t.Fatalf("failed to query devices: %v", err)
	}

	seen := make(map[string]bool)
	for _, dev := range allDevices {
		if seen[dev.Number] {
			t.Errorf("发现重复的设备四位后缀: %s (设备 ID: %s)", dev.Number, dev.DeviceID)
		}
		seen[dev.Number] = true
	}

	t.Logf("并发唯一性测试通过。共成功创建 %d 个设备，零冲突，零重复。", len(allDevices))
}
