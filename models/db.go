package models

import (
	"log"
	"os"
	"time"

	"code-pdm/config"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
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

	var dialector gorm.Dialector
	if config.AppConfig.Database.Driver == "sqlite" || config.AppConfig.Database.Host == "" {
		dbPath := config.AppConfig.Database.Path
		if dbPath == "" {
			dbPath = "file::memory:?cache=shared"
		}
		log.Printf("Connecting to SQLite database (%s) for testing/fallback...\n", dbPath)
		dialector = sqlite.Open(dbPath)
	} else {
		dsn := config.AppConfig.Database.GetDSN()
		log.Printf("Connecting to PostgreSQL database (%s)...\n", config.AppConfig.Database.DBName)
		dialector = postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true,
		})
	}

	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger:                                   dbLogger,
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err == nil {
		if config.AppConfig.Database.Driver == "sqlite" || config.AppConfig.Database.Host == "" {
			sqlDB.SetMaxOpenConns(1)
		} else {
			sqlDB.SetMaxOpenConns(20)
		}
	}

	log.Println("AutoMigrating database schema...")
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
