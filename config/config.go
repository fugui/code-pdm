package config

import (
	"os"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Server struct {
		Port   string `yaml:"port"`
		GinLog bool   `yaml:"gin_log"`
	} `yaml:"server"`
	Auth struct {
		JWTSecret string `yaml:"jwt_secret"`
	} `yaml:"auth"`
	Database struct {
		Path string `yaml:"path"`
	} `yaml:"database"`
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
