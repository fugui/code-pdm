package config

import (
	commonModels "code-common/backend/models"
	"os"

	"gopkg.in/yaml.v3"
)

type DatabaseConfig = commonModels.DatabaseConfig

type Config struct {
	Server struct {
		Port   string `yaml:"port"`
		GinLog bool   `yaml:"gin_log"`
	} `yaml:"server"`
	Auth struct {
		StandaloneMode       bool                      `yaml:"standalone_mode"`
		JWTSecret            string                    `yaml:"jwt_secret"`
		PasswordLoginEnabled bool                      `yaml:"password_login_enabled"`
		OAuth2               commonModels.OAuth2Config `yaml:"oauth2"`
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
