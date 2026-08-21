package main

import (
	"context"
	"embed"
	"flag"
	"log"

	commonAudit "code-common/backend/audit"
	commonAuth "code-common/backend/auth"
	commonServer "code-common/backend/server"
	"code-pdm/config"
	"code-pdm/handlers"
	"code-pdm/models"

	"github.com/gin-gonic/gin"
)

//go:embed all:frontend/dist
var frontendFS embed.FS

func main() {
	configPath := flag.String("config", "config.yaml", "Path to configuration file")
	flag.Parse()

	log.Printf("[PDM] Starting Product Data Management (PDM) Service...\n")

	// 1. 加载配置
	if err := config.LoadConfig(*configPath); err != nil {
		log.Fatalf("[PDM] Failed to load config %s: %v", *configPath, err)
	}

	// 2. 初始化数据库
	models.InitDB()

	// 初始化系统全局操作审计引擎
	commonAudit.Init(models.DB)

	// 确保至少存在默认管理员账号（用于独立部署模式）
	if err := commonAuth.EnsureSeedAdmin(models.DB, "pdm_admin"); err != nil {
		log.Printf("[PDM] Warning: Failed to ensure seed admin: %v", err)
	}

	// 3. 启动统一服务器
	err := commonServer.Run(commonServer.Options{
		ServiceName:  "PDM",
		Prefix:       "pdm",
		Port:         config.AppConfig.Server.Port,
		GinLog:       config.AppConfig.Server.GinLog,
		ReadTimeout:  config.AppConfig.Server.ReadTimeout,
		WriteTimeout: config.AppConfig.Server.WriteTimeout,
		IdleTimeout:  config.AppConfig.Server.IdleTimeout,
		FrontendFS:   &frontendFS,
		CustomMiddlewares: []gin.HandlerFunc{
			commonAudit.Middleware("pdm"),
		},
		OnShutdown: func(ctx context.Context) {
			_ = commonAudit.Close(ctx)
		},
		RegisterRoutes: func(r *gin.Engine) {
			// 未保护路由
			r.POST("/api/login", handlers.Login)
			r.GET("/api/auth/config", handlers.GetAuthConfig)
			r.GET("/api/oauth2/authorize", handlers.StartOAuth2Flow)
			r.GET("/api/oauth2/callback", handlers.OAuth2Callback)

			// 受保护路由
			protected := r.Group("/api")
			protected.Use(commonAuth.AuthMiddleware(commonAuth.AuthConfig{
				JWTSecretGetter: func() string { return config.AppConfig.Auth.JWTSecret },
				DB:              models.DB,
			}))
			{
				protected.GET("/me", handlers.GetMe)
				protected.PATCH("/password", handlers.UpdatePassword)

				// 设备类型路由
				protected.GET("/device-types", handlers.GetDeviceTypes)
				protected.GET("/device-types/:id", handlers.GetDeviceType)

				// 设备 ID 路由
				protected.GET("/devices", handlers.GetDevices)
				protected.GET("/devices/:id", handlers.GetDevice)
				protected.GET("/devices/generate-suffix", handlers.GenerateSuffix)
				protected.GET("/export/excel", handlers.ExportAllExcel)

				// 管理员权限写操作
				admin := protected.Group("/")
				admin.Use(commonAuth.RequireAdmin(commonAuth.RolePdmAdmin))
				{
					admin.POST("/device-types", handlers.CreateDeviceType)
					admin.PUT("/device-types/:id", handlers.UpdateDeviceType)
					admin.DELETE("/device-types/:id", handlers.DeleteDeviceType)

					admin.POST("/devices", handlers.CreateDevice)
					admin.PUT("/devices/:id", handlers.UpdateDevice)
					admin.DELETE("/devices/:id", handlers.DeleteDevice)
				}
			}
		},
	})
	if err != nil {
		log.Fatalf("[PDM] Server error: %v", err)
	}
}
