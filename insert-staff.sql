INSERT INTO staffs (full_name, email, password, role, branch_id, created_at, updated_at)
VALUES 
  ('John Agent', 'agent1@livesupport.com', 'password123', 'agent', 1, NOW(), NOW()),
  ('Jane Agent', 'agent2@livesupport.com', 'password123', 'agent', 1, NOW(), NOW()),
  ('Admin User', 'admin@livesupport.com', 'admin123', 'admin', 1, NOW(), NOW())
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password, full_name = EXCLUDED.full_name;
