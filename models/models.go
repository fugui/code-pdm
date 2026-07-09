package models

import (
	"time"
)

// User 用户实体
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex;not null" json:"username"`
	Name      string    `gorm:"not null" json:"name"`
	Password  string    `gorm:"not null" json:"-"` // 不在 JSON 中输出密码哈希
	IsAdmin   bool      `gorm:"default:false" json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
}

// DeviceType 设备类型实体
type DeviceType struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Model       string    `gorm:"uniqueIndex;not null;size:50" json:"model"` // 用户可见型号
	Name        string    `gorm:"not null" json:"name"`                      // 设备类型名称
	Description string    `json:"description"`                               // 说明
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Device 设备实体
type Device struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	DeviceID     string     `gorm:"uniqueIndex;not null;size:20" json:"device_id"` // A1234 格式
	Letter       string     `gorm:"not null;size:1" json:"letter"`                 // 单个字母前缀
	Number       string     `gorm:"uniqueIndex;not null;size:4" json:"number"`     // 四位数字后缀，全局唯一
	Name         string     `gorm:"not null" json:"name"`                          // 设备名称
	Description  string     `json:"description"`                                   // 说明
	Date         string     `gorm:"not null;size:10" json:"date"`                  // YYYY-MM-DD
	DeviceTypeID uint       `gorm:"not null" json:"device_type_id"`                // 关联设备类型ID
	DeviceType   DeviceType `gorm:"foreignKey:DeviceTypeID;constraint:OnDelete:RESTRICT" json:"device_type,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}
