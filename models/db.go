package models

import (
	"code-common/backend/gormdb"
	"log"

	"code-pdm/config"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB 初始化数据库与自动迁移
func InitDB() {
	var err error

	DB, err = gormdb.Connect(config.AppConfig.Database, gormdb.Options{
		ServiceName: "PDM-DB",
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	log.Println("AutoMigrating database schema...")
	err = DB.AutoMigrate(
		&User{},
		&DeviceType{},
		&Device{},
		&SysAuditLog{},
	)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// 预设用户种子数据
	seedUsers()
}

func seedUsers() {
	var count int64
	DB.Model(&User{}).Count(&count)
	if count == 0 {
		// 创建管理员账号 (admin / admin123)
		adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		admin := User{
			Username: "admin",
			Name:     "管理员",
			Password: string(adminHash),
			Roles:    datatypes.JSON([]byte("[\"super_admin\"]")),
		}
		if err := DB.Create(&admin).Error; err != nil {
			log.Printf("failed to seed admin user: %v", err)
		} else {
			log.Println("Seeded admin user (username: admin, password: admin123)")
		}

		// 创建普通账号 (user / user123)
		userHash, _ := bcrypt.GenerateFromPassword([]byte("user123"), bcrypt.DefaultCost)
		normalUser := User{
			Username: "user",
			Name:     "普通用户",
			Password: string(userHash),
		}
		if err := DB.Create(&normalUser).Error; err != nil {
			log.Printf("failed to seed normal user: %v", err)
		} else {
			log.Println("Seeded normal user (username: user, password: user123)")
		}
	}
}
