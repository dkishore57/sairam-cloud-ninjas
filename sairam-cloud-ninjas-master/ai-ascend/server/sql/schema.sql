CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
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
  role ENUM('user', 'assistant') NOT NULL,
  text MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_user_created_at (user_id, created_at),
  CONSTRAINT fk_chat_messages_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_learning_paths (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  path_title VARCHAR(220) NOT NULL,
  path_summary TEXT NOT NULL,
  career_goal VARCHAR(160) NOT NULL,
  current_level VARCHAR(64) NOT NULL,
  hours_per_week INT NOT NULL,
  learning_style VARCHAR(120) NOT NULL,
  timeline_weeks INT NOT NULL,
  roadmap_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_generated_paths_user_created_at (user_id, created_at),
  CONSTRAINT fk_generated_paths_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS skill_gap_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_role VARCHAR(160) NOT NULL,
  resume_text MEDIUMTEXT NOT NULL,
  provided_skills_json JSON NOT NULL,
  job_description MEDIUMTEXT NOT NULL,
  analysis_summary TEXT NOT NULL,
  strengths_json JSON NOT NULL,
  missing_skills_json JSON NOT NULL,
  recommendations_json JSON NOT NULL,
  recommended_paths_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_skill_gap_reports_user_created_at (user_id, created_at),
  CONSTRAINT fk_skill_gap_reports_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS career_recommendations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  answers_json JSON NOT NULL,
  analysis_summary TEXT NOT NULL,
  matches_json JSON NOT NULL,
  recommended_paths_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_career_recommendations_user_created_at (user_id, created_at),
  CONSTRAINT fk_career_recommendations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_quiz_generations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  path_id VARCHAR(64) NOT NULL,
  video_id VARCHAR(64) NOT NULL,
  video_title VARCHAR(255) NOT NULL,
  quiz_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_video_quiz_user_video_created_at (user_id, video_id, created_at),
  CONSTRAINT fk_video_quiz_generations_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_gamification (
  user_id CHAR(36) PRIMARY KEY,
  total_xp INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE NULL,
  badges_json JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_gamification_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS xp_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  points INT NOT NULL,
  path_id VARCHAR(64) NULL,
  video_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_xp_event_user_action (user_id, event_type, path_id, video_id),
  INDEX idx_xp_events_user_created_at (user_id, created_at),
  CONSTRAINT fk_xp_events_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resume_review_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  target_role VARCHAR(160) NOT NULL,
  job_description MEDIUMTEXT NOT NULL,
  ats_score INT NOT NULL,
  summary TEXT NOT NULL,
  strengths_json JSON NOT NULL,
  changes_json JSON NOT NULL,
  keyword_gaps_json JSON NOT NULL,
  rewritten_bullets_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_resume_review_user_created_at (user_id, created_at),
  CONSTRAINT fk_resume_review_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_planner_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  course_name VARCHAR(180) NOT NULL,
  topic VARCHAR(220) NOT NULL,
  duration_min INT NOT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('pending', 'completed', 'skipped') NOT NULL DEFAULT 'pending',
  reminder_minutes INT NOT NULL DEFAULT 10,
  planned_start DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_study_planner_user_planned_start (user_id, planned_start),
  CONSTRAINT fk_study_planner_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
