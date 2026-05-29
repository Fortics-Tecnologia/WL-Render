job "theme-lab" {
  datacenters = ["dc1"]
  type        = "service"

  group "web" {
    count = 1

    restart {
      attempts = 5
      interval = "2m"
      delay    = "15s"
      mode     = "fail"
    }

    network {
      port "http" {
        to = 3000
      }
    }

    service {
      name     = "theme-lab"
      port     = "http"
      provider = "nomad"

      tags = [
        "traefik.enable=true",
        "traefik.http.routers.theme-lab.rule=Host(`themelab.genier.ai`)",
        "traefik.http.routers.theme-lab.middlewares=theme-lab-rl",
        "traefik.http.middlewares.theme-lab-rl.ratelimit.average=60",
        "traefik.http.middlewares.theme-lab-rl.ratelimit.burst=60",
        "traefik.http.middlewares.theme-lab-rl.ratelimit.period=1m",
      ]
    }

    task "theme-lab" {
      driver         = "docker"
      kill_timeout   = "30s"
      shutdown_delay = "5s"

      config {
        image = "us-central1-docker.pkg.dev/gcp-fortics-genier/genier/fortics-theme-lab:latest"
        ports = ["http"]
        volumes = [
          "/nfs/__whitelabels__:/nfs/__whitelabels__",
        ]
      }

      env {
        PORT          = "3000"
        NFS_BASE_PATH = "/nfs/__whitelabels__"
        NODE_ENV      = "production"
      }

      resources {
        cpu    = 128
        memory = 128
      }

      logs {
        max_files     = 3
        max_file_size = 20
        disabled      = false
      }
    }
  }
}
