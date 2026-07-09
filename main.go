package main

import (
	"context"
	"embed"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"code-pdm/config"
	"code-pdm/handlers"
	"code-pdm/models"

	"github.com/gin-gonic/gin"
)

//go:embed all:frontend/dist
var frontendFS embed.FS

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func main() {
	configPath := flag.String("config", "config.yaml", "Path to config file")
	flag.Parse()

	log.Println("[PDM] Starting Product Data Management server...")

	// 1. 加载配置
	if err := config.LoadConfig(*configPath); err != nil {
		log.Fatalf("[PDM] Failed to load config %s: %v", *configPath, err)
	}

	// 2. 初始化数据库
	models.InitDB()

	// 3. 初始化 Gin
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	if config.AppConfig.Server.GinLog {
		r.Use(gin.Logger())
	}
	r.Use(corsMiddleware())

	// 4. 注册 API 路由
	// 未保护路由
	r.POST("/api/login", handlers.Login)

	// 受保护路由 (普通用户只读，管理员读写)
	protected := r.Group("/api")
	protected.Use(handlers.AuthMiddleware())
	{
		protected.GET("/me", handlers.GetMe)

		// 设备类型路由
		protected.GET("/device-types", handlers.GetDeviceTypes)
		protected.GET("/device-types/:id", handlers.GetDeviceType)

		// 设备 ID 路由
		protected.GET("/devices", handlers.GetDevices)
		protected.GET("/devices/:id", handlers.GetDevice)
		protected.GET("/devices/generate-suffix", handlers.GenerateSuffix)
		protected.GET("/device-types/export", handlers.ExportDeviceTypes)
		protected.GET("/devices/export", handlers.ExportDevices)

		// 需要管理员权限的写操作
		admin := protected.Group("/")
		admin.Use(handlers.AdminMiddleware())
		{
			admin.POST("/device-types", handlers.CreateDeviceType)
			admin.PUT("/device-types/:id", handlers.UpdateDeviceType)
			admin.DELETE("/device-types/:id", handlers.DeleteDeviceType)

			admin.POST("/devices", handlers.CreateDevice)
			admin.PUT("/devices/:id", handlers.UpdateDevice)
			admin.DELETE("/devices/:id", handlers.DeleteDevice)
		}
	}

	// 5. 挂载内嵌前端静态文件 (Vite build dist)
	distFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		log.Println("[PDM] Warning: frontend dist folder not found, skipping frontend embedding.")
	} else {
		httpFS := http.FS(distFS)
		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path

			// API 路由未匹配，返回 404，不重定向至前端 index.html
			if len(path) >= 4 && path[:4] == "/api" {
				c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
				return
			}

			// 如果访问 / 或者 /pdm 则重定向至 /pdm/
			if path == "/" || path == "/pdm" {
				c.Redirect(http.StatusFound, "/pdm/")
				return
			}

			// 移除 /pdm 前缀来匹配内嵌的静态资源
			cleanPath := path
			if strings.HasPrefix(path, "/pdm") {
				cleanPath = strings.TrimPrefix(path, "/pdm")
			}

			if cleanPath != "" && cleanPath != "/" {
				f, err := distFS.Open(cleanPath[1:])
				if err == nil {
					f.Close()
					c.FileFromFS(cleanPath, httpFS)
					return
				}
			}

			// 所有非静态资源均 Fallback 到前端单页路由 index.html
			indexBytes, err := fs.ReadFile(distFS, "index.html")
			if err != nil {
				c.String(http.StatusNotFound, "index.html not found")
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
		})
	}

	port := config.AppConfig.Server.Port
	if port == "" {
		port = ":8085"
	}

	// 我们对 Gin 进行路由重置以支持从 code-bench 网关代理过来时剥离 `/pdm` 前缀的操作
	var handler http.Handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if strings.HasPrefix(req.URL.Path, "/pdm/api") {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/pdm")
		}
		r.ServeHTTP(w, req)
	})

	srv := &http.Server{
		Addr:    port,
		Handler: handler,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("[PDM] Starting server on %s ...\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[PDM] Server failed to start: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("[PDM] Shutting down PDM server ...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("[PDM] Server forced to shutdown: %v", err)
	}
	log.Println("[PDM] Server exited gracefully")
}
