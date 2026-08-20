package handlers

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	commonAudit "code-common/backend/audit"
	commonAuth "code-common/backend/auth"
	commonModels "code-common/backend/models"

	"code-pdm/config"
	"code-pdm/models"
	"code-pdm/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

var pdmOAuth2States *commonAuth.StateStore

func init() {
	pdmOAuth2States = commonAuth.NewStateStore()
}

func GetAuthConfig(c *gin.Context) {
	authCfg := config.AppConfig.Auth
	passwordEnabled := authCfg.StandaloneMode || authCfg.PasswordLoginEnabled
	oauth2Enabled := authCfg.OAuth2.Enabled

	c.JSON(http.StatusOK, gin.H{
		"oauth2_enabled":         oauth2Enabled,
		"password_login_enabled": passwordEnabled,
		"dept_api_url":           authCfg.OAuth2.DeptAPIURL,
	})
}

// Login 独立运行时的登录接口
func Login(c *gin.Context) {
	authCfg := config.AppConfig.Auth
	if !authCfg.StandaloneMode && !authCfg.PasswordLoginEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "本地直接登录已停用，请使用主门户登录。"})
		return
	}

	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不合法"})
		return
	}

	identifier := strings.ToLower(strings.TrimSpace(req.Username))
	if identifier == "" {
		identifier = strings.ToLower(strings.TrimSpace(req.Email))
	}
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入用户名或邮箱"})
		return
	}

	var user models.User
	if err := models.DB.Where("LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)", identifier, identifier).First(&user).Error; err != nil {
		commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
			fmt.Sprintf("用户登录失败: 尝试账号 [%s], 用户不存在", identifier),
			"user", "", identifier, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	if !user.IsActive {
		commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
			fmt.Sprintf("用户登录失败: 尝试账号 [%s], 账号已被禁用", identifier),
			"user", fmt.Sprintf("%d", user.ID), user.Name, nil, nil)
		c.JSON(http.StatusForbidden, gin.H{"error": "账号已被禁用"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
			fmt.Sprintf("用户登录失败: 尝试账号 [%s], 密码错误", identifier),
			"user", fmt.Sprintf("%d", user.ID), user.Name, nil, nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Username, user.Name, user.GetRoles())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Token 生成失败"})
		return
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Username
	}

	commonAuth.SetUserContext(c, &commonAuth.UserContext{
		UserID:   user.ID,
		Username: user.Username,
		Name:     user.Name,
		Email:    user.Email,
		Roles:    user.GetRoles(),
	})

	commonAudit.SetAuditContext(c, "auth", "login", commonModels.AuditLevelP2,
		fmt.Sprintf("用户 [%s] 登录系统成功 (IP: %s)", displayName, c.ClientIP()),
		"user", fmt.Sprintf("%d", user.ID), displayName, nil, nil)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"username": user.Username,
			"name":     user.Name,
			"roles":    user.GetRoles(),
		},
	})
}

func UpdatePassword(c *gin.Context) {
	authCfg := config.AppConfig.Auth
	if !authCfg.StandaloneMode && !authCfg.PasswordLoginEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请在 CodeBench 主控制台修改您的密码！"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID missing"})
		return
	}

	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := models.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "当前密码不正确"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := models.DB.Model(&user).Update("password", string(hashed)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Username
	}
	commonAudit.SetAuditContext(c, "auth", "update_password", commonModels.AuditLevelP1,
		fmt.Sprintf("用户 [%s] 修改个人密码成功", displayName),
		"user", fmt.Sprintf("%d", user.ID), displayName, nil, nil)

	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}

// GetMe 获取当前登录用户信息
func GetMe(c *gin.Context) {
	uc := commonAuth.GetUserContext(c)
	c.JSON(http.StatusOK, gin.H{
		"id":       uc.UserID,
		"username": uc.Username,
		"name":     uc.Name,
		"email":    uc.Email,
		"roles":    uc.Roles,
	})
}

func StartOAuth2Flow(c *gin.Context) {
	oauth2Cfg := config.AppConfig.Auth.OAuth2
	if !oauth2Cfg.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "OAuth2 SSO is not enabled"})
		return
	}

	state, _, codeChallenge, err := pdmOAuth2States.GenerateState()
	if err != nil {
		log.Printf("[OAuth2] Failed to generate state: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initiate SSO login"})
		return
	}

	params := url.Values{
		"response_type":         {"code"},
		"client_id":             {oauth2Cfg.ClientID},
		"redirect_uri":          {oauth2Cfg.RedirectURL},
		"scope":                 {strings.Join(oauth2Cfg.Scopes, " ")},
		"state":                 {state},
		"code_challenge":        {codeChallenge},
		"code_challenge_method": {"S256"},
	}

	authURL := oauth2Cfg.AuthURL + "?" + params.Encode()
	c.Redirect(http.StatusFound, authURL)
}

func OAuth2Callback(c *gin.Context) {
	oauth2Cfg := config.AppConfig.Auth.OAuth2
	if !oauth2Cfg.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "OAuth2 SSO is not enabled"})
		return
	}

	if errMsg := c.Query("error"); errMsg != "" {
		errDesc := c.Query("error_description")
		log.Printf("[OAuth2] IdP returned error: %s - %s", errMsg, errDesc)
		redirectPdmSSOError(c, "SSO 登录失败: "+errDesc)
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		redirectPdmSSOError(c, "SSO 回调参数缺失")
		return
	}

	codeVerifier, ok := pdmOAuth2States.ValidateAndConsume(state)
	if !ok {
		redirectPdmSSOError(c, "SSO 登录超时或状态无效，请重试")
		return
	}

	tokenData, err := commonAuth.ExchangeCodeForToken(oauth2Cfg, code, codeVerifier)
	if err != nil {
		log.Printf("[OAuth2] Token exchange failed: %v", err)
		redirectPdmSSOError(c, "SSO Token 交换失败")
		return
	}

	accessToken, _ := tokenData["access_token"].(string)
	if accessToken == "" {
		redirectPdmSSOError(c, "SSO 未返回有效的 access_token")
		return
	}

	userInfo, err := commonAuth.FetchUserInfo(oauth2Cfg.UserInfoURL, oauth2Cfg.ClientID, oauth2Cfg.Scopes, accessToken)
	if err != nil {
		log.Printf("[OAuth2] UserInfo fetch failed: %v", err)
		redirectPdmSSOError(c, "SSO 用户信息获取失败")
		return
	}

	mapping := oauth2Cfg.FieldMapping
	email := strings.ToLower(strings.TrimSpace(commonAuth.GetStringField(userInfo, mapping.Email)))
	rawUsername := commonAuth.GetStringField(userInfo, mapping.Username)
	name := commonAuth.ParseSSOAttribute(rawUsername)
	if customName := commonAuth.GetStringField(userInfo, mapping.Name); customName != "" {
		name = customName
	}

	if email == "" {
		email = strings.ToLower(strings.TrimSpace(commonAuth.ParseSSOEnglishName(rawUsername)))
	}
	if email == "" {
		redirectPdmSSOError(c, "SSO 未返回用户邮箱或标识信息")
		return
	}

	if !commonAuth.IsEmailDomainAllowed(email, oauth2Cfg.AllowedEmailDomains) {
		var count int64
		if err := models.DB.Model(&models.User{}).Where("LOWER(email) = LOWER(?)", email).Count(&count).Error; err != nil || count == 0 {
			redirectPdmSSOError(c, "邮箱域名未被允许，请联系系统管理员")
			return
		}
	}

	var user models.User
	if err := models.DB.Where("LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)", email, email).First(&user).Error; err != nil {
		user = models.User{
			Username:  email,
			Email:     email,
			Name:      name,
			Password:  "$2a$10$SSO_USER_NO_PASSWORD",
			IsActive:  true,
			RegMethod: "sso",
		}
		if errCreate := models.DB.Create(&user).Error; errCreate != nil {
			log.Printf("[OAuth2] Auto register PDM user failed: %v", errCreate)
			redirectPdmSSOError(c, "SSO 用户自动创建失败")
			return
		}
	}

	tokenString, err := utils.GenerateToken(user.ID, user.Username, user.Name, user.GetRoles())
	if err != nil {
		redirectPdmSSOError(c, "登录凭证生成失败")
		return
	}

	displayName := user.Name
	if displayName == "" {
		displayName = user.Username
	}

	commonAuth.SetUserContext(c, &commonAuth.UserContext{
		UserID:   user.ID,
		Username: user.Username,
		Name:     user.Name,
		Email:    user.Email,
		Roles:    user.GetRoles(),
	})

	commonAudit.SetAuditContext(c, "auth", "sso_login", commonModels.AuditLevelP2,
		fmt.Sprintf("用户 [%s] SSO单点登录系统成功 (IP: %s)", displayName, c.ClientIP()),
		"user", fmt.Sprintf("%d", user.ID), displayName, nil, nil)

	redirectTarget := "/?token=" + url.QueryEscape(tokenString)
	c.Redirect(http.StatusFound, redirectTarget)
}

func redirectPdmSSOError(c *gin.Context, errorMsg string) {
	loginURL := "/login?sso_error=" + url.QueryEscape(errorMsg)
	c.Redirect(http.StatusFound, loginURL)
}
