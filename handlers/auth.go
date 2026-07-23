package handlers

import (
	"net/http"
	"strings"

	"code-pdm/models"
	"code-pdm/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AuthMiddleware 身份验证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未携带 Authorization 凭证"})
			c.Abort()
			return
		}

		tokenString := authHeader
		if len(authHeader) > 7 && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = authHeader[7:]
		}

		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "身份凭证无效或已过期"})
			c.Abort()
			return
		}

		// 挂载会话元数据
		c.Set("username", claims.Username)
		c.Set("name", claims.Name)
		c.Set("isAdmin", claims.IsAdmin)
		c.Set("roles", claims.Roles)

		c.Next()
	}
}

// AdminMiddleware 管理员鉴权中间件
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdminVal, exists := c.Get("isAdmin")
		isAdmin := exists && isAdminVal.(bool)

		rolesVal, rolesExists := c.Get("roles")
		hasRole := false
		if rolesExists {
			if roles, ok := rolesVal.([]string); ok {
				for _, r := range roles {
					if r == "super_admin" || r == "pdm_admin" {
						hasRole = true
						break
					}
				}
			}
		}

		if !isAdmin && !hasRole {
			c.JSON(http.StatusForbidden, gin.H{"error": "操作失败，仅限 PDM 管理员或超级管理员操作"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// Login 独立运行时的登录接口
func Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不合法"})
		return
	}

	var user models.User
	if err := models.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Username, user.Name, user.IsAdmin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token 生成失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"username": user.Username,
			"name":     user.Name,
			"is_admin": user.IsAdmin,
		},
	})
}

// GetMe 获取当前登录用户信息
func GetMe(c *gin.Context) {
	username, _ := c.Get("username")
	name, _ := c.Get("name")
	isAdmin, _ := c.Get("isAdmin")

	c.JSON(http.StatusOK, gin.H{
		"username": username,
		"name":     name,
		"is_admin": isAdmin,
	})
}
