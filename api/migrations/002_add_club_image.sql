-- ترقية: إضافة عمود image لجدول clubs
-- شغّلها مرة واحدة على قواعد البيانات المُهيَّأة قبل هذه الإضافة.
-- لقواعد البيانات الجديدة، schema.sql محدَّث بالفعل.

ALTER TABLE clubs
  ADD COLUMN image VARCHAR(255) NULL AFTER icon;

-- توسيع عمود icon للسماح برموز أطول مثل "</>"
ALTER TABLE clubs
  MODIFY COLUMN icon VARCHAR(16) NOT NULL;
