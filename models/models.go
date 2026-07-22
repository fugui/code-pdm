package models

import (
	"time"
)

// User 用户实体
type User struct {
	ID           uint        `gorm:"primaryKey" json:"id"`
	UniqueID     *string     `gorm:"uniqueIndex" json:"unique_id,omitempty"`
	EmployeeID   string      `gorm:"index;default:''" json:"employee_id"`
	EmployeeType string      `gorm:"default:''" json:"employee_type"`
	Email        string      `gorm:"uniqueIndex;not null;default:''" json:"email"`
	Username     string      `gorm:"index;default:''" json:"username"`
	Name         string      `gorm:"not null;default:''" json:"name"`
	Password     string      `gorm:"not null" json:"-"`
	RegMethod    string      `gorm:"default:'local'" json:"reg_method"`
	IsActive     bool        `gorm:"default:true" json:"is_active"`
	IsAdmin      bool        `gorm:"default:false" json:"is_admin"`
	LastLogin    *time.Time  `json:"last_login"`
	LastIP       string      `gorm:"default:''" json:"last_ip"`
	DepartmentID *uint       `json:"department_id"`
	CreatedAt    time.Time   `json:"created_at"`
}

// DeviceType 设备类型实体
type DeviceType struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Model       string    `gorm:"uniqueIndex;not null;size:50" json:"model"` // 用户可见型号
	Letter      string    `gorm:"not null;size:1;default:'E'" json:"letter"` // 首字母前缀，大写单个英文字母
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
