-- ============================================================
-- رواق — مخطط قاعدة البيانات (MySQL / MariaDB)
-- ============================================================
-- لإنشاء قاعدة البيانات يدوياً (مرة واحدة):
--   CREATE DATABASE riwaq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE riwaq;
--   SOURCE schema.sql;
--   SOURCE seed.sql;
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+03:00';   -- توقيت الرياض

-- ============================================================
-- الأندية
-- ============================================================
CREATE TABLE IF NOT EXISTS clubs (
    id           VARCHAR(16)  NOT NULL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    short_name   VARCHAR(60)  NULL,
    category     VARCHAR(40)  NOT NULL,
    college      VARCHAR(120) NOT NULL,
    members      INT          NOT NULL DEFAULT 0,
    color        VARCHAR(20)  NOT NULL,
    icon         VARCHAR(16)  NOT NULL,            -- حرف/رمز افتراضي
    image        VARCHAR(255) NULL,                -- مسار صورة الشعار (اختياري)
    description  TEXT         NOT NULL,
    cover        VARCHAR(255) NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- المستخدمون (admin + presidents)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            INT          NOT NULL PRIMARY KEY AUTO_INCREMENT,
    username      VARCHAR(32)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','president') NOT NULL,
    club_id       VARCHAR(16)  NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME     NULL,
    INDEX idx_role (role),
    INDEX idx_club (club_id),
    CONSTRAINT fk_user_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    CONSTRAINT chk_president_has_club CHECK (role <> 'president' OR club_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- نادي واحد = حساب رئيس واحد
CREATE UNIQUE INDEX uniq_president_per_club ON users (club_id);

-- ============================================================
-- جلسات (token-based)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    token       CHAR(64)     NOT NULL PRIMARY KEY,    -- hex(32 bytes)
    user_id     INT          NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME     NOT NULL,
    ip_address  VARCHAR(45)  NULL,
    user_agent  VARCHAR(255) NULL,
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- الفعاليات
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id               INT          NOT NULL PRIMARY KEY AUTO_INCREMENT,
    club_id          VARCHAR(16)  NOT NULL,
    title            VARCHAR(200) NOT NULL,
    description      TEXT         NULL,
    event_date       DATE         NOT NULL,
    event_time       TIME         NOT NULL,
    location         VARCHAR(200) NOT NULL,
    spots            INT          NOT NULL DEFAULT 0,
    taken            INT          NOT NULL DEFAULT 0,
    registration_url VARCHAR(500) NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_club (club_id),
    INDEX idx_date (event_date),
    CONSTRAINT fk_event_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    CONSTRAINT chk_spots CHECK (spots >= 0 AND taken >= 0 AND taken <= spots)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- المنشورات (post / announcement / event)
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    id                INT          NOT NULL PRIMARY KEY AUTO_INCREMENT,
    club_id           VARCHAR(16)  NOT NULL,
    type              ENUM('post','announcement','event') NOT NULL,
    title             VARCHAR(200) NOT NULL,
    body              TEXT         NOT NULL,
    tags              JSON         NULL,
    image             VARCHAR(255) NULL,
    external_url      VARCHAR(500) NULL,
    linked_event_id   INT          NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_club (club_id),
    INDEX idx_type (type),
    INDEX idx_created (created_at DESC),
    CONSTRAINT fk_post_club  FOREIGN KEY (club_id)         REFERENCES clubs(id)  ON DELETE CASCADE,
    CONSTRAINT fk_post_event FOREIGN KEY (linked_event_id) REFERENCES events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- حسابات السوشال
-- ============================================================
CREATE TABLE IF NOT EXISTS socials (
    id        INT          NOT NULL PRIMARY KEY AUTO_INCREMENT,
    club_id   VARCHAR(16)  NOT NULL,
    platform  ENUM('twitter','instagram','snapchat','tiktok','telegram') NOT NULL,
    handle    VARCHAR(120) NOT NULL,
    url       VARCHAR(500) NOT NULL,
    UNIQUE KEY uniq_club_platform (club_id, platform),
    CONSTRAINT fk_social_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- سجل التدقيق
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id            BIGINT       NOT NULL PRIMARY KEY AUTO_INCREMENT,
    user_id       INT          NULL,
    username      VARCHAR(32)  NULL,
    action        VARCHAR(40)  NOT NULL,
    resource_type VARCHAR(20)  NULL,
    resource_id   VARCHAR(40)  NULL,
    details       JSON         NULL,
    ip_address    VARCHAR(45)  NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- محدّد المعدّل (rate limiting)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
    key_hash      CHAR(64)  NOT NULL PRIMARY KEY,   -- sha256(ip|endpoint)
    request_count INT       NOT NULL DEFAULT 1,
    window_start  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- محاولات تسجيل الدخول (للحماية من البروت فورس)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id           BIGINT       NOT NULL PRIMARY KEY AUTO_INCREMENT,
    username     VARCHAR(64)  NULL,
    ip_address   VARCHAR(45)  NULL,
    success      TINYINT(1)   NOT NULL DEFAULT 0,
    attempted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_time (ip_address, attempted_at),
    INDEX idx_username_time (username, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
