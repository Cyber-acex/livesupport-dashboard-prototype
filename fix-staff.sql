UPDATE staffs SET branch_id = 1 WHERE email IN ('agent1@livesupport.com', 'agent2@livesupport.com', 'admin@livesupport.com');
SELECT id, email, full_name, branch_id FROM staffs WHERE email IN ('agent1@livesupport.com', 'agent2@livesupport.com', 'admin@livesupport.com');
