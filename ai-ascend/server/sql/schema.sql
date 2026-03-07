CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_video_progress (
  user_id CHAR(36) NOT NULL,
  path_id VARCHAR(64) NOT NULL,
  video_id VARCHAR(64) NOT NULL,
  watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, path_id, video_id),
  CONSTRAINT fk_user_video_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_path_completion (
  user_id CHAR(36) NOT NULL,
  path_id VARCHAR(64) NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, path_id),
  CONSTRAINT fk_user_path_completion_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  path_id VARCHAR(64) NOT NULL DEFAULT 'frontend',
  role ENUM('user', 'assistant') NOT NULL,
  text MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_user_path_created_at (user_id, path_id, created_at),
  CONSTRAINT fk_chat_messages_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
