package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type DatabaseConfig struct {
	Driver       string `yaml:"driver"`
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	User         string `yaml:"user"`
	Password     string `yaml:"password"`
	DBName       string `yaml:"dbname"`
	SSLMode      string `yaml:"sslmode"`
	TimeZone     string `yaml:"timezone"`
	MaxOpenConns int    `yaml:"max_open_conns"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
	Path         string `yaml:"path"`
}

func (d *DatabaseConfig) GetDSN() string {
	host := d.Host
	if host == "" {
		host = "127.0.0.1"
	}
	port := d.Port
	if port <= 0 {
		port = 5432
	}
	user := d.User
	if user == "" {
		user = "postgres"
	}
	dbname := d.DBName
	if dbname == "" {
		dbname = "code_shield"
	}
	sslmode := d.SSLMode
	if sslmode == "" {
		sslmode = "disable"
	}
	timezone := d.TimeZone
	if timezone == "" {
		timezone = "Asia/Shanghai"
	}
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=%s",
		host, user, d.Password, dbname, port, sslmode, timezone)
}

type Config struct {
	Server struct {
		Port   string `yaml:"port"`
		GinLog bool   `yaml:"gin_log"`
	} `yaml:"server"`
	Auth struct {
		JWTSecret string `yaml:"jwt_secret"`
	} `yaml:"auth"`
	Database DatabaseConfig `yaml:"database"`
}

var AppConfig Config

// LoadConfig 从指定 YAML 文件加载配置
func LoadConfig(path string) error {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return yaml.Unmarshal(bytes, &AppConfig)
}
