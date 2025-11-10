# QuDAG MCP-SSE Deployment Guide

## Production Deployment

This guide covers deploying the QuDAG MCP-SSE server in production environments with security, scalability, and reliability best practices.

## Prerequisites

- Node.js 18+ or Docker
- TLS certificates (for HTTPS)
- OAuth2 provider (Keycloak, Auth0, or equivalent)
- Redis (for distributed deployments)
- PostgreSQL (for audit logs)

## Deployment Architectures

### 1. Single Server Deployment

**Recommended for**: Development, testing, and small deployments

```
┌─────────────────────────────────┐
│      Client Applications        │
└────────────┬────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────┐
│    QuDAG MCP Server             │
│  - Streamable HTTP Transport    │
│  - OAuth2 Authentication        │
│  - In-Memory Rate Limiting      │
└─────────────────────────────────┘
```

**Docker Compose**:

```yaml
version: '3.8'
services:
  mcp-server:
    build: .
    ports:
      - "8443:8443"
    environment:
      QUDAG_PROTOCOL: https
      QUDAG_TLS_CERT_PATH: /certs/server.crt
      QUDAG_TLS_KEY_PATH: /certs/server.key
      QUDAG_OAUTH2_ISSUER_URL: https://auth.qudag.io
      QUDAG_OAUTH2_AUDIENCE: qudag-mcp-api
      QUDAG_REQUIRE_AUTH: "true"
    volumes:
      - ./certs:/certs:ro
    restart: unless-stopped
```

### 2. Load Balanced Deployment

**Recommended for**: Production with high availability

```
┌────────────────────────────────────────┐
│      Client Applications               │
└────────────┬─────────────────────────┘
             │ HTTPS
             ▼
┌────────────────────────────────────────┐
│  Load Balancer (Nginx / HAProxy)       │
│  - TLS Termination                     │
│  - Request Routing                     │
│  - Connection Pooling                  │
└──────────┬─────────────────────────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
┌─────┐ ┌─────┐ ┌─────┐
│MCP-1│ │MCP-2│ │MCP-3│
└──┬──┘ └──┬──┘ └──┬──┘
   │      │      │
   └──────┼──────┘
          ▼
    ┌──────────────┐
    │ Redis Cache  │
    │ Session Store│
    └──────────────┘
          │
          ▼
    ┌──────────────┐
    │ PostgreSQL   │
    │ Audit Logs   │
    └──────────────┘
```

**Nginx Configuration**:

```nginx
upstream mcp_backend {
    least_conn;
    server mcp-server-1:8443;
    server mcp-server-2:8443;
    server mcp-server-3:8443;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.qudag.io;

    ssl_certificate /etc/letsencrypt/live/api.qudag.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.qudag.io/privkey.pem;
    ssl_protocols TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer" always;

    location /mcp {
        proxy_pass https://mcp_backend;
        proxy_ssl_verify off;
        proxy_ssl_verify_depth 0;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Timeouts for long operations
        proxy_read_timeout 300s;
        proxy_connect_timeout 30s;
    }

    location /health {
        proxy_pass https://mcp_backend;
        proxy_ssl_verify off;
        access_log off;
    }
}

server {
    listen 80;
    server_name api.qudag.io;
    return 301 https://$server_name$request_uri;
}
```

### 3. Kubernetes Deployment

**Recommended for**: Cloud-native environments

```yaml
---
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: qudag

---
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-config
  namespace: qudag
data:
  QUDAG_PROTOCOL: "https"
  QUDAG_LOG_LEVEL: "info"
  QUDAG_REQUIRE_AUTH: "true"
  QUDAG_OAUTH2_ISSUER_URL: "https://auth.qudag.io"
  QUDAG_OAUTH2_AUDIENCE: "qudag-mcp-api"
  QUDAG_REDIS_URL: "redis://redis:6379"

---
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qudag-mcp
  namespace: qudag
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: qudag-mcp
  template:
    metadata:
      labels:
        app: qudag-mcp
    spec:
      containers:
      - name: mcp-server
        image: qudag/mcp-sse:0.1.0
        imagePullPolicy: IfNotPresent
        ports:
        - name: https
          containerPort: 8443
          protocol: TCP
        envFrom:
        - configMapRef:
            name: mcp-config
        env:
        - name: QUDAG_TLS_CERT_PATH
          value: "/etc/certs/tls.crt"
        - name: QUDAG_TLS_KEY_PATH
          value: "/etc/certs/tls.key"
        volumeMounts:
        - name: certs
          mountPath: /etc/certs
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: https
            scheme: HTTPS
          initialDelaySeconds: 10
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: https
            scheme: HTTPS
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 2
        resources:
          requests:
            cpu: 500m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 512Mi
      volumes:
      - name: certs
        secret:
          secretName: mcp-tls
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - qudag-mcp
              topologyKey: kubernetes.io/hostname

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: qudag-mcp
  namespace: qudag
spec:
  type: ClusterIP
  ports:
  - port: 443
    targetPort: https
    protocol: TCP
    name: https
  selector:
    app: qudag-mcp

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: qudag-mcp
  namespace: qudag
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
spec:
  tls:
  - hosts:
    - api.qudag.io
    secretName: mcp-tls
  rules:
  - host: api.qudag.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: qudag-mcp
            port:
              number: 443
```

## TLS Certificate Setup

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly \
  --standalone \
  -d api.qudag.io \
  -d quantum.qudag.io

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### Self-Signed Certificate (Development Only)

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout server.key \
  -out server.crt \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"
```

## OAuth2 Configuration

### Keycloak Setup

1. Create realm: `qudag`
2. Create client: `qudag-mcp-api`
3. Set client access type: `public`
4. Add valid redirect URI: `https://api.qudag.io/callback`
5. Configure OpenID Connect settings

### Environment Variables

```bash
export QUDAG_OAUTH2_ISSUER_URL=https://keycloak.qudag.io/auth/realms/qudag
export QUDAG_OAUTH2_AUDIENCE=qudag-mcp-api
export QUDAG_OAUTH2_JWKS_URL=https://keycloak.qudag.io/auth/realms/qudag/protocol/openid-connect/certs
```

## Monitoring & Observability

### Prometheus Metrics

Enable Prometheus metrics export:

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto
```

### Logging Configuration

Send logs to central aggregation:

```bash
export QUDAG_LOG_FORMAT=json
export QUDAG_AUDIT_ENABLED=true
```

Integration with ELK/Datadog:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: qudag
data:
  filebeat.yml: |
    filebeat.inputs:
    - type: container
      paths:
        - '/var/lib/docker/containers/*/*.log'
    processors:
      - add_kubernetes_metadata:
    output.elasticsearch:
      hosts: ["elasticsearch:9200"]
```

## Performance Tuning

### Node.js Optimization

```bash
# Increase file descriptors
ulimit -n 65536

# Enable clustering
export NODE_CLUSTER_ENABLED=true

# Optimize garbage collection
node --max-old-space-size=2048 dist/server.js
```

### Redis Configuration

```conf
# redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

## Security Hardening

### Network Security

1. **Firewall Rules**:
   - Allow HTTPS (443) from load balancer only
   - Restrict SSH to admin networks
   - Block all other inbound traffic

2. **Network Policies (Kubernetes)**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mcp-network-policy
  namespace: qudag
spec:
  podSelector:
    matchLabels:
      app: qudag-mcp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx-ingress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
```

### Resource Limits

```yaml
resources:
  requests:
    cpu: 500m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi
```

## Disaster Recovery

### Backup Strategy

```bash
# Backup configurations
tar czf qudag-config-backup.tar.gz /etc/qudag/

# Backup TLS certificates
tar czf qudag-certs-backup.tar.gz /etc/certs/

# Backup audit logs (daily)
tar czf qudag-audit-logs-$(date +%Y%m%d).tar.gz \
  /var/log/qudag/audit/
```

### Recovery Procedures

1. Stop services
2. Restore from backups
3. Verify configuration
4. Restart services
5. Monitor health

## Scaling Guidelines

- **Vertical**: Up to 4 CPU cores, 4GB RAM per instance
- **Horizontal**: Add servers behind load balancer
- **Database**: Use read replicas for audit logs

## Support & Troubleshooting

### Common Issues

1. **Connection refused**: Check firewall and port binding
2. **TLS certificate error**: Verify certificate path and permissions
3. **High memory usage**: Monitor and tune Node.js heap size
4. **Rate limiting errors**: Adjust `QUDAG_RATE_LIMIT` setting

### Debug Logging

```bash
export QUDAG_LOG_LEVEL=debug
export DEBUG=qudag:*
```

## Compliance

- **SOC 2**: Enable audit logging and monitoring
- **GDPR**: Configure data retention policies
- **HIPAA**: Use encryption at rest and in transit
- **PCI-DSS**: Enable rate limiting and authentication

---

For additional support, visit: https://docs.qudag.io/deployment
