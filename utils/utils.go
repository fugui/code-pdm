package utils

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"code-pdm/config"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// Claims 定义与 code-bench 一致的 JWT 荷载结构
type Claims struct {
	UserID     uint   `json:"user_id"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Name       string `json:"name"`
	EmployeeID string `json:"employee_id"`
	IsAdmin    bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

// GenerateToken 生成本地登录 JWT (主要用于独立运行调试)
func GenerateToken(userID uint, username string, name string, isAdmin bool) (string, error) {
	secret := []byte(config.AppConfig.Auth.JWTSecret)
	if len(secret) == 0 {
		secret = []byte("ABCDEFGHIJKLMNOPQRSTVUWXYZ0987654321") // 缺省回退
	}
	expirationTime := time.Now().Add(6 * time.Hour)

	claims := &Claims{
		UserID:   userID,
		Username: username,
		Name:     name,
		IsAdmin:  isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// ParseToken 解析并校验 JWT
func ParseToken(tokenString string) (*Claims, error) {
	secret := []byte(config.AppConfig.Auth.JWTSecret)
	if len(secret) == 0 {
		secret = []byte("ABCDEFGHIJKLMNOPQRSTVUWXYZ0987654321")
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// FormatLetter 校验并格式化设备ID首字母（支持任意单个大写或小写英文字母 A-Z）
func FormatLetter(letter string) (string, error) {
	letter = strings.ToUpper(strings.TrimSpace(letter))
	if len(letter) == 1 && letter[0] >= 'A' && letter[0] <= 'Z' {
		return letter, nil
	}
	return "", errors.New("首字母前缀必须是单个英文字母 A-Z")
}

// GenerateUniqueNumber 随机生成全局不重复的四位数字 (0000-9999) 后缀
func GenerateUniqueNumber(db *gorm.DB) (string, error) {
	// 最多尝试 10000 次，若容量满了则报错
	for i := 0; i < 10000; i++ {
		nBig, err := rand.Int(rand.Reader, big.NewInt(10000))
		if err != nil {
			return "", err
		}
		val := nBig.Int64()
		suffix := fmt.Sprintf("%04d", val)

		// 检查在整个 devices 表中，该 number 后缀是否存在
		var count int64
		if err := db.Table("devices").Where("number = ?", suffix).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return suffix, nil
		}
	}
	return "", errors.New("设备四位数字后缀空间已耗尽（最多10,000个设备）")
}
