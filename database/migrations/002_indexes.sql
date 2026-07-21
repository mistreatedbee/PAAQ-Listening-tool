-- PAAQ Listening Platform — Performance Indexes

-- events: most frequently queried table
CREATE INDEX idx_events_project_id       ON events(project_id);
CREATE INDEX idx_events_user_id          ON events(user_id);
CREATE INDEX idx_events_session_id       ON events(session_id);
CREATE INDEX idx_events_timestamp        ON events(timestamp DESC);
CREATE INDEX idx_events_event_name       ON events(event_name);
CREATE INDEX idx_events_project_ts       ON events(project_id, timestamp DESC);

-- errors
CREATE INDEX idx_errors_project_id       ON errors(project_id);
CREATE INDEX idx_errors_status           ON errors(status);
CREATE INDEX idx_errors_severity         ON errors(severity);
CREATE INDEX idx_errors_created_at       ON errors(created_at DESC);
CREATE INDEX idx_errors_project_status   ON errors(project_id, status);

-- sessions
CREATE INDEX idx_sessions_project_id     ON sessions(project_id);
CREATE INDEX idx_sessions_user_id        ON sessions(user_id);
CREATE INDEX idx_sessions_status         ON sessions(status);
CREATE INDEX idx_sessions_started_at     ON sessions(started_at DESC);

-- api_requests
CREATE INDEX idx_api_requests_project_id ON api_requests(project_id);
CREATE INDEX idx_api_requests_endpoint   ON api_requests(endpoint);
CREATE INDEX idx_api_requests_created_at ON api_requests(created_at DESC);
CREATE INDEX idx_api_requests_error      ON api_requests(error) WHERE error = true;

-- performance_metrics
CREATE INDEX idx_perf_project_type       ON performance_metrics(project_id, metric_type);
CREATE INDEX idx_perf_created_at         ON performance_metrics(created_at DESC);

-- users
CREATE INDEX idx_users_project_id        ON users(project_id);
CREATE INDEX idx_users_external_id       ON users(external_user_id);

-- incidents
CREATE INDEX idx_incidents_project_id    ON incidents(project_id);
CREATE INDEX idx_incidents_status        ON incidents(status);

-- notifications
CREATE INDEX idx_notifications_project   ON notifications(project_id, read);
CREATE INDEX idx_notifications_created   ON notifications(created_at DESC);
