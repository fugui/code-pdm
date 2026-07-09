package models

import (
	"log"
	"os"
	"time"

	"code-pdm/config"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库与自动迁移
func InitDB() {
	var err error
	dbLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	dbPath := config.AppConfig.Database.Path
	if dbPath == "" {
		dbPath = "code_pdm.db"
	}

	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: dbLogger,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	// 限制 SQLite 连接数为 1 彻底避免高并发锁库和死锁
	sqlDB, err := DB.DB()
	if err == nil {
		sqlDB.SetMaxOpenConns(1)
	}

	log.Printf("AutoMigrating database schema for %s ...\n", dbPath)
	err = DB.AutoMigrate(
		&User{},
		&DeviceType{},
		&Device{},
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
			IsAdmin:  true,
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
			IsAdmin:  false,
		}
		if err := DB.Create(&normalUser).Error; err != nil {
			log.Printf("failed to seed normal user: %v", err)
		} else {
			log.Println("Seeded normal user (username: user, password: user123)")
		}
	}
}
