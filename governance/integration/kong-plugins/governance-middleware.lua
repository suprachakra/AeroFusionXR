-- Kong Governance Middleware Plugin
-- Intercepts all API calls to inject governance checks

local plugin = {
  PRIORITY = 1000, -- High priority to run early in the request cycle
  VERSION = "1.0.0",
}

local http = require "resty.http"
local cjson = require "cjson"
local redis = require "resty.redis"

-- Plugin configuration schema
plugin.SCHEMA = {
  name = "governance-middleware",
  fields = {
    { config = {
        type = "record",
        fields = {
          { governance_api_url = { type = "string", default = "http://governance-orchestrator:8000" } },
          { redis_host = { type = "string", default = "redis" } },
          { redis_port = { type = "integer", default = 6379 } },
          { enable_bias_detection = { type = "boolean", default = true } },
          { enable_audit_logging = { type = "boolean", default = true } },
          { enable_privacy_transforms = { type = "boolean", default = true } },
          { enable_rate_limiting = { type = "boolean", default = true } },
          { ai_services = { 
              type = "array", 
              elements = { type = "string" },
              default = { "ai-concierge", "wayfinding", "baggage-tracker" }
            }
          },
        },
      },
    },
  },
}

-- Initialize Redis connection
local function get_redis_connection(config)
  local red = redis:new()
  red:set_timeout(1000) -- 1 second timeout
  
  local ok, err = red:connect(config.redis_host, config.redis_port)
  if not ok then
    kong.log.err("Failed to connect to Redis: ", err)
    return nil
  end
  
  return red
end

-- Check if service is an AI service requiring governance
local function is_ai_service(service_name, ai_services)
  for _, ai_service in ipairs(ai_services) do
    if string.find(service_name, ai_service) then
      return true
    end
  end
  return false
end

-- Log governance event to audit trail
local function log_governance_event(config, event_type, event_data)
  if not config.enable_audit_logging then
    return
  end
  
  local httpc = http.new()
  httpc:set_timeout(5000) -- 5 second timeout
  
  local audit_data = {
    timestamp = ngx.time(),
    event_type = event_type,
    service = kong.router.get_service().name,
    route = kong.router.get_route().name,
    client_ip = kong.client.get_forwarded_ip(),
    user_agent = kong.request.get_header("user-agent"),
    request_id = kong.ctx.shared.request_id,
    data = event_data
  }
  
  local res, err = httpc:request_uri(config.governance_api_url .. "/audit/log", {
    method = "POST",
    body = cjson.encode(audit_data),
    headers = {
      ["Content-Type"] = "application/json",
      ["X-Governance-Source"] = "kong-middleware"
    }
  })
  
  if not res then
    kong.log.err("Failed to log governance event: ", err)
  end
end

-- Perform bias detection on AI responses
local function detect_bias(config, response_body, service_name)
  if not config.enable_bias_detection or not is_ai_service(service_name, config.ai_services) then
    return false, nil
  end
  
  local httpc = http.new()
  httpc:set_timeout(3000) -- 3 second timeout
  
  local bias_check_data = {
    service = service_name,
    response = response_body,
    timestamp = ngx.time()
  }
  
  local res, err = httpc:request_uri(config.governance_api_url .. "/bias/detect", {
    method = "POST",
    body = cjson.encode(bias_check_data),
    headers = {
      ["Content-Type"] = "application/json",
      ["X-Governance-Source"] = "kong-middleware"
    }
  })
  
  if not res then
    kong.log.err("Failed to perform bias detection: ", err)
    return false, nil
  end
  
  if res.status == 200 then
    local result = cjson.decode(res.body)
    return result.bias_detected, result.bias_score
  end
  
  return false, nil
end

-- Apply privacy-enhancing transformations
local function apply_privacy_transforms(config, response_body)
  if not config.enable_privacy_transforms then
    return response_body
  end
  
  local httpc = http.new()
  httpc:set_timeout(2000) -- 2 second timeout
  
  local transform_data = {
    data = response_body,
    transformations = { "pii_redaction", "differential_privacy" }
  }
  
  local res, err = httpc:request_uri(config.governance_api_url .. "/privacy/transform", {
    method = "POST",
    body = cjson.encode(transform_data),
    headers = {
      ["Content-Type"] = "application/json",
      ["X-Governance-Source"] = "kong-middleware"
    }
  })
  
  if not res then
    kong.log.err("Failed to apply privacy transforms: ", err)
    return response_body
  end
  
  if res.status == 200 then
    local result = cjson.decode(res.body)
    return result.transformed_data
  end
  
  return response_body
end

-- Check governance rate limits
local function check_governance_rate_limit(config, client_ip, service_name)
  if not config.enable_rate_limiting then
    return true
  end
  
  local red = get_redis_connection(config)
  if not red then
    return true -- Allow request if Redis is unavailable
  end
  
  local key = "governance:rate_limit:" .. service_name .. ":" .. client_ip
  local current_count, err = red:get(key)
  
  if not current_count or current_count == ngx.null then
    current_count = 0
  else
    current_count = tonumber(current_count)
  end
  
  -- Different rate limits for different services
  local rate_limit = 100 -- Default: 100 requests per minute
  if is_ai_service(service_name, config.ai_services) then
    rate_limit = 50 -- AI services: 50 requests per minute
  end
  
  if current_count >= rate_limit then
    red:close()
    return false
  end
  
  -- Increment counter
  red:incr(key)
  red:expire(key, 60) -- 1 minute expiry
  red:close()
  
  return true
end

-- Access phase: Run before the request is proxied to the upstream service
function plugin:access(config)
  local service_name = kong.router.get_service().name
  local client_ip = kong.client.get_forwarded_ip()
  
  -- Generate unique request ID for tracking
  kong.ctx.shared.request_id = kong.tools.uuid.uuid()
  
  -- Check governance rate limits
  if not check_governance_rate_limit(config, client_ip, service_name) then
    log_governance_event(config, "rate_limit_exceeded", {
      client_ip = client_ip,
      service = service_name
    })
    
    return kong.response.exit(429, {
      message = "Governance rate limit exceeded",
      retry_after = 60
    })
  end
  
  -- Log request for audit trail
  log_governance_event(config, "request_received", {
    method = kong.request.get_method(),
    path = kong.request.get_path(),
    headers = kong.request.get_headers()
  })
  
  -- Add governance headers to upstream request
  kong.service.request.set_header("X-Governance-Request-ID", kong.ctx.shared.request_id)
  kong.service.request.set_header("X-Governance-Timestamp", ngx.time())
  kong.service.request.set_header("X-Governance-Client-IP", client_ip)
end

-- Response phase: Run after receiving response from upstream service
function plugin:response(config)
  local service_name = kong.router.get_service().name
  local response_body = kong.response.get_raw_body()
  
  if response_body then
    -- Perform bias detection on AI service responses
    if is_ai_service(service_name, config.ai_services) then
      local bias_detected, bias_score = detect_bias(config, response_body, service_name)
      
      if bias_detected then
        log_governance_event(config, "bias_detected", {
          service = service_name,
          bias_score = bias_score,
          response_sample = string.sub(response_body, 1, 500) -- First 500 chars
        })
        
        -- Add bias warning header
        kong.response.set_header("X-Governance-Bias-Warning", "true")
        kong.response.set_header("X-Governance-Bias-Score", tostring(bias_score))
      end
    end
    
    -- Apply privacy-enhancing transformations
    local transformed_body = apply_privacy_transforms(config, response_body)
    if transformed_body ~= response_body then
      kong.response.set_raw_body(transformed_body)
      kong.response.set_header("X-Governance-Privacy-Applied", "true")
    end
  end
  
  -- Log response for audit trail
  log_governance_event(config, "response_sent", {
    status = kong.response.get_status(),
    headers = kong.response.get_headers(),
    body_size = response_body and string.len(response_body) or 0
  })
  
  -- Add governance headers to response
  kong.response.set_header("X-Governance-Request-ID", kong.ctx.shared.request_id)
  kong.response.set_header("X-Governance-Version", plugin.VERSION)
end

-- Log phase: Run after response is sent to client
function plugin:log(config)
  local service_name = kong.router.get_service().name
  local latency = kong.ctx.shared.response_latency or 0
  
  -- Log performance metrics
  log_governance_event(config, "request_completed", {
    latency_ms = latency,
    service = service_name,
    status = kong.response.get_status()
  })
  
  -- Update governance metrics in Redis
  local red = get_redis_connection(config)
  if red then
    local metrics_key = "governance:metrics:" .. service_name
    red:hincrby(metrics_key, "total_requests", 1)
    red:hincrby(metrics_key, "total_latency", latency)
    red:expire(metrics_key, 3600) -- 1 hour expiry
    red:close()
  end
end

return plugin 