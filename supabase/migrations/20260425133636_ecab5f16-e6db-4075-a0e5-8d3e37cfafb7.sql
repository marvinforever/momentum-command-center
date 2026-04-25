-- ====================================================================
-- MOMENTUM COMMAND CENTER · Historical Data Migration
-- Imports real historical data from Ani's tracking spreadsheet
-- ====================================================================

-- LEAD MAGNETS (5 active opt-ins)
INSERT INTO public.lead_magnets (id, name, type, status, hosted_on, sequence_days, total_downloads, description, notes)
VALUES
  ('11111111-1111-1111-1111-000000000001', 'Communication Cheat Sheet (CCS)', 'CCS', 'Active', 'Kajabi', 15, 800,
   '5 Communication Moves That Rebuild Real Connection. Internal name: CCS. Public name: The Connection Code. Foundation lead magnet for high-achieving men whose marriages are quietly struggling.',
   'Drives the 7-day email sequence (extended Day 0/3/6/9/11/13/15)'),
  ('11111111-1111-1111-1111-000000000002', 'Daily Brief', 'Daily Brief', 'Active', 'Kajabi', NULL, NULL,
   'Daily email opt-in. Top of funnel for newsletter-style nurturing.', NULL),
  ('11111111-1111-1111-1111-000000000003', 'Applications (RIC)', 'Application', 'Active', 'Kajabi', NULL, NULL,
   'RIC application form. Higher intent opt-in.', NULL),
  ('11111111-1111-1111-1111-000000000004', 'Drop the Armor Free Bonus', 'Bonus', 'Active', 'Kajabi', NULL, NULL,
   'Free bonus tied to Christine''s book Drop the Armor.', NULL),
  ('11111111-1111-1111-1111-000000000005', 'High Performance Strategy Session', 'Strategy Session', 'Active', 'Kajabi', NULL, NULL,
   'Books a discovery call directly. Higher intent than CCS.', NULL)
ON CONFLICT (id) DO NOTHING;

-- OFFERS (RIC)
INSERT INTO public.offers (id, name, type, status, price, cohort_size, description)
VALUES
  ('22222222-2222-2222-2222-000000000001', 'RIC - Rapid Implementation Challenge', 'Coaching Program', 'Active', 21000, 8,
   '4-month paid coaching for high-achieving founders + spouses. VSL with Three Thieves framework. CTA: book a discovery call.')
ON CONFLICT (id) DO NOTHING;

-- CAMPAIGNS (5 active)
INSERT INTO public.campaigns (id, name, status, type, primary_channel, start_date, end_date, goal, lead_goal, booking_goal, enrollment_goal, budget, spend_to_date, lead_magnet_id, offer_id, notes)
VALUES
  ('33333333-3333-3333-3333-000000000001', 'RIC April Cohort Push', 'Live', 'Launch', 'Multi-Channel',
   '2026-04-14', '2026-05-02', 'Fill the April cohort, 6 enrollments minimum', 80, 16, 6, 3500, 1840,
   '11111111-1111-1111-1111-000000000001', '22222222-2222-2222-2222-000000000001',
   'Three-week push coordinated across email sequence (CCS list), Christine''s LinkedIn, and a retargeting Meta ad.'),
  ('33333333-3333-3333-3333-000000000002', 'Connection Code Promo', 'Live', 'Evergreen', 'Meta Ads',
   NULL, NULL, 'Always-on CCS lead capture, CPL target $25', NULL, NULL, NULL, NULL, 4260,
   '11111111-1111-1111-1111-000000000001', NULL,
   'Evergreen Meta Ads driving CCS opt-ins. Currently $19.35 CPL, below target.'),
  ('33333333-3333-3333-3333-000000000003', 'Q2 Podcast Tour', 'Warming', 'Tour', 'Podcast',
   '2026-04-01', '2026-06-30', 'Christine guesting on 8+ podcasts in Q2', NULL, NULL, NULL, NULL, 0,
   NULL, NULL,
   '6 booked, 2 aired. Faith & Marriage appearance drove 41 attributable leads.'),
  ('33333333-3333-3333-3333-000000000004', 'LinkedIn Daily Posting', 'Live', 'Evergreen', 'LinkedIn',
   NULL, NULL, 'Maintain 5x weekly cadence', NULL, NULL, NULL, NULL, 0,
   NULL, NULL,
   'Christine''s daily organic LinkedIn posting. Word swap carousels outperforming text-only 3:1.'),
  ('33333333-3333-3333-3333-000000000005', 'YouTube Evergreen', 'Live', 'Evergreen', 'YouTube',
   NULL, NULL, 'Long-form videos compounding', NULL, NULL, NULL, NULL, 0,
   NULL, NULL,
   '"Strong Men Stop Reaching" alone drove 87 leads in April. Long tail compounding.')
ON CONFLICT (id) DO NOTHING;

-- LEADS (8 real leads from Ani's pipeline)
INSERT INTO public.leads (id, name, first_touch_date, lead_source, opt_in, status, gender, notes, lead_magnet_id, campaign_id)
VALUES
  ('44444444-4444-4444-4444-000000000001', 'Rett Paulsen', '2026-04-03', 'YouTube', 'CCS', 'Not a Fit', 'Female',
   'Female - not a fit (RIC ICP is male)',
   '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000005'),
  ('44444444-4444-4444-4444-000000000002', 'Drew Regan', '2026-04-12', 'YouTube', 'CCS', 'Enrolled', 'Male',
   'Good Fit, Champion Potential. Wife bought in, CEO bought in. F/U Call booked.',
   '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000001'),
  ('44444444-4444-4444-4444-000000000003', 'Manish S Mehta', '2026-04-09', 'YouTube', 'CCS', 'Held Call', 'Male',
   '70% Fit. Not a Christian. Pending decision.',
   '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000005'),
  ('44444444-4444-4444-4444-000000000004', 'Ray Row', '2026-04-22', 'Facebook Ad', 'CCS', 'Not a Fit', 'Male',
   NULL, '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000002'),
  ('44444444-4444-4444-4444-000000000005', 'Tim Cunningham', '2026-04-22', 'YouTube', 'CCS', 'Lost', 'Male',
   'Booked 10 min, did not progress to discovery.',
   '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000005'),
  ('44444444-4444-4444-4444-000000000006', 'Antonio Wright', '2026-04-22', 'YouTube', 'CCS', 'Not a Fit', 'Male',
   NULL, '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000005'),
  ('44444444-4444-4444-4444-000000000007', 'Jeff Zimmer', '2026-04-24', 'LinkedIn', 'CCS', 'Held Call', 'Male',
   'F/U Call booked. Strong fit signals.',
   '11111111-1111-1111-1111-000000000001', '33333333-3333-3333-3333-000000000004'),
  ('44444444-4444-4444-4444-000000000008', 'Kerry Doole', '2026-04-24', 'Instagram', 'CCS', 'Booked Call', 'Male',
   'Booked 10 min for May 6.',
   '11111111-1111-1111-1111-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

-- DISCOVERY CALLS (matching the 8 leads)
INSERT INTO public.discovery_calls (id, lead_id, name, call_date, call_type, status, lead_source, follow_up_actions, offer_id, notes)
VALUES
  ('55555555-5555-5555-5555-000000000001', '44444444-4444-4444-4444-000000000001', 'Rett Paulsen',
   '2026-04-03', 'Discovery Call', 'Not a Fit', 'YouTube', NULL,
   '22222222-2222-2222-2222-000000000001', 'Female, RIC ICP is male'),
  ('55555555-5555-5555-5555-000000000002', '44444444-4444-4444-4444-000000000002', 'Drew Regan',
   '2026-04-12', 'Discovery Call', 'Won', 'YouTube', ARRAY['F/U Call Booked', 'Attended F/U Call'],
   '22222222-2222-2222-2222-000000000001', 'Champion. Wife and CEO bought in. Enrolled in RIC April cohort.'),
  ('55555555-5555-5555-5555-000000000003', '44444444-4444-4444-4444-000000000003', 'Manish S Mehta',
   '2026-04-09', 'Discovery Call', 'Pending', 'YouTube', ARRAY['F/U Call Booked'],
   '22222222-2222-2222-2222-000000000001', '70% fit, not Christian, pending decision'),
  ('55555555-5555-5555-5555-000000000004', '44444444-4444-4444-4444-000000000004', 'Ray Row',
   '2026-04-22', 'Pre Qual', 'Not a Fit', 'Facebook Ad', NULL,
   '22222222-2222-2222-2222-000000000001', 'Pre-qual call only, did not advance'),
  ('55555555-5555-5555-5555-000000000005', '44444444-4444-4444-4444-000000000005', 'Tim Cunningham',
   '2026-04-22', 'Pre Qual', 'Lost', 'YouTube', NULL,
   '22222222-2222-2222-2222-000000000001', 'Booked 10 min, did not progress'),
  ('55555555-5555-5555-5555-000000000006', '44444444-4444-4444-4444-000000000006', 'Antonio Wright',
   '2026-04-22', 'Pre Qual', 'Not a Fit', 'YouTube', NULL,
   '22222222-2222-2222-2222-000000000001', 'Not a fit'),
  ('55555555-5555-5555-5555-000000000007', '44444444-4444-4444-4444-000000000007', 'Jeff Zimmer',
   '2026-04-24', 'Discovery Call', 'Pending', 'LinkedIn', ARRAY['F/U Call Booked'],
   '22222222-2222-2222-2222-000000000001', 'F/U Call booked, strong fit signals'),
  ('55555555-5555-5555-5555-000000000008', '44444444-4444-4444-4444-000000000008', 'Kerry Doole',
   '2026-05-06', 'Pre Qual', 'Pending', 'Instagram', NULL,
   '22222222-2222-2222-2222-000000000001', '10-min call scheduled')
ON CONFLICT (id) DO NOTHING;

-- CONTENT (LinkedIn posts + key YouTube/Podcast — 34 rows)
INSERT INTO public.content (id, title, channel, format, publish_date, topic, key_word, reach, engagement, profile_views, followers_gained, leads_attributed, effect_rating, link, campaign_id)
VALUES
  ('66666666-6666-6666-6666-000000000001', '5 signs you''ve lost the connection and don''t even know it', 'LinkedIn', 'Image', '2026-04-24', 'Connection signs / awareness', 'CONNECTION', 145, 7, 0, 0, 3, 'Low', 'https://www.linkedin.com/posts/christine-jewell-9361612a_5-signs-youve-lost-the-connection-and-dont-activity-7453414397571510272', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000002', 'Anxiety in Uncertainty has taught a valuable lesson', 'LinkedIn', 'Image', '2026-04-23', 'Anxiety, uncertainty, faith', 'IDENTITY', 350, 18, 4, 0, 4, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_anxiety-in-uncertainty-has-taught-a-valuable-activity-7453090817935831041', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000003', 'There are times in life when storms hit', 'LinkedIn', 'Image', '2026-04-22', 'Storms, faith, uncertainty', 'IDENTITY', 156, 4, 0, 0, 1, 'Low', 'https://www.linkedin.com/posts/christine-jewell-9361612a_there-are-times-in-life-when-storms-hit-activity-7452712546903646208', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000004', 'Not everyone deserves your time, energy, or leadership wisdom', 'LinkedIn', 'Image', '2026-04-01', 'Boundaries, leadership wisdom', 'CAPACITY', 388, 9, 3, 0, 2, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_not-everyone-deserves-your-time-energy-activity-7449808592544792576', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000005', 'Unification Leads to Multiplication', 'LinkedIn', 'Image', '2026-03-31', 'Unification, multiplication', 'KINGDOM', 744, 27, 4, 0, 3, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_unification-leads-to-multiplication-every-activity-7449446504076947456', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000006', 'Who is protecting your marriage?', 'LinkedIn', 'Image', '2026-03-27', 'Marriage protection', 'CONNECTION', 196, 14, 3, 0, 1, 'Low', 'https://www.linkedin.com/posts/christine-jewell-9361612a_who-is-protecting-your-marriage-who-is-activity-7447996096405979136', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000007', 'Want to transform your marriage?', 'LinkedIn', 'Image', '2026-03-25', 'Marriage transformation', 'CONNECTION', 380, 21, 3, 0, 2, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_want-to-transform-your-marriage-be-present-activity-7446918946638753792', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000008', 'What if the biggest limiter in your marriage isn''t your spouse', 'LinkedIn', 'Image', '2026-03-22', 'Marriage, self-awareness', 'IDENTITY', 322, 15, 5, 0, 2, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_what-if-the-biggest-limiter-in-your-marriage-activity-7445097912692363265', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000009', 'Boundaries are not a luxury', 'LinkedIn', 'Image', '2026-03-21', 'Boundaries, leadership', 'CAPACITY', 176, 12, 0, 0, 1, 'Low', 'https://www.linkedin.com/posts/christine-jewell-9361612a_boundaries-are-not-a-luxury-they-are-a-leadership-activity-7444774403097235457', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000010', '5 Moves for a Stronger, More Connected Marriage', 'LinkedIn', 'Image', '2026-03-19', 'Marriage moves', 'CONNECTION', 619, 20, 10, 0, 5, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_5-moves-for-a-stronger-more-connected-marriage-activity-7441117882811371520', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000011', 'On Betrayal, Self Worth and Learning to Trust again', 'LinkedIn', 'Image', '2026-03-12', 'Betrayal, self-worth, trust', 'IDENTITY', 217, 10, 0, 0, 1, 'Low', 'https://www.linkedin.com/posts/christine-jewell-9361612a_on-betrayal-self-worth-and-learning-to-trust-activity-7440044508421099520', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000012', 'We went through a hard season in order to get to this place', 'LinkedIn', 'Image', '2026-03-10', 'Hard season, breakthrough', 'IDENTITY', 1338, 44, 15, 1, 6, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_we-went-through-a-hard-season-in-order-to-activity-7439662336493142017', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000013', 'To those of you navigating a season of betrayal right now', 'LinkedIn', 'Image', '2026-03-08', 'Betrayal, season', 'IDENTITY', 790, 27, 0, 1, 3, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_to-those-of-you-navigating-a-season-of-betrayal-activity-7438589184304484353', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000014', 'Are you chasing the wind?', 'LinkedIn', 'Image', '2026-03-05', 'Wisdom, pursuit', 'KINGDOM', 300, 0, 25, 0, 1, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_are-you-chasing-the-wind-some-of-the-wisest-activity-7437502868045172736', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000015', 'How do I turn it off?', 'LinkedIn', 'Image', '2026-03-04', 'Burnout, capacity', 'CAPACITY', 549, 1, 27, 0, 2, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_how-do-i-turn-it-off-that-was-the-number-activity-7436797910794727425', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000016', 'Your marriage is some of the most valuable real estate', 'LinkedIn', 'Newsletter', '2026-03-01', 'Marriage value, investment', 'CONNECTION', 968, 1, 11, 0, 4, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_your-marriage-is-some-of-the-most-valuable-activity-7435716690883026957', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000017', 'Nothing costs more than regret', 'LinkedIn', 'Image', '2026-02-26', 'Regret, action', 'LEGACY', 1330, 38, 25, 2, 7, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_nothing-costs-more-than-regret-if-im-activity-7434630533445386240', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000018', 'A deeply fulfilling and rich life requires an unshakable identity', 'LinkedIn', 'Image', '2026-02-25', 'Identity, fulfillment', 'IDENTITY', 405, 28, 5, 6, 3, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_a-deeply-fulfilling-and-rich-life-requires-activity-7434990630235447296', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000019', 'Finances. Parenting. Church.', 'LinkedIn', 'Image', '2026-02-18', 'Marriage challenges', 'CONNECTION', 548, 11, 6, 0, 2, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_finances-parenting-church-health-in-laws-activity-7429897078962704384', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000020', 'Let''s talk about non-negotiables', 'LinkedIn', 'Image', '2026-02-10', 'Non-negotiables, leadership', 'IDENTITY', 443, 20, 4, 0, 2, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_i-lets-talk-about-non-negotiatables-for-activity-7427003553493340162', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000021', 'Today is a BIG day for us', 'LinkedIn', 'Image', '2026-01-14', 'Milestone, gratitude', 'LEGACY', 1140, 39, 10, 1, 5, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_today-is-a-big-day-for-us-it-marks-the-activity-7417227292176941056', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000022', 'There''s a lot of noise and fast talk in the coaching space', 'LinkedIn', 'Image', '2026-01-13', 'Coaching landscape, depth', 'DIAGNOSE', 1565, 44, 25, 0, 8, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_theres-a-lot-of-noise-and-fast-talk-in-the-activity-7416846332281167873', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000023', 'Let me share a powerful story of redemption and restoration', 'LinkedIn', 'Image', '2026-01-10', 'Redemption, restoration', 'FREEDOM', 480, 29, 8, 0, 4, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_let-me-share-a-powerful-story-of-redemption-activity-7415766197323137024', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000024', 'Are you the bottleneck causing your own friction', 'LinkedIn', 'Image', '2026-01-04', 'Self-awareness, bottleneck', 'DIAGNOSE', 161, 11, 4, 0, 1, 'Low', 'https://www.linkedin.com/posts/christine-jewell-9361612a_are-you-the-bottleneck-causing-your-own-friction-activity-7415377848103899136', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000025', 'The root of all control issues is FEAR', 'LinkedIn', 'Image', '2026-01-03', 'Control, fear', 'DIAGNOSE', 1250, 32, 15, 4, 6, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_the-root-of-all-control-issues-is-fear-activity-7413302354017685504', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000026', 'One of the greatest limitations we face isn''t vision, it''s CAPACITY', 'LinkedIn', 'Image', '2025-12-30', 'Capacity, limits', 'CAPACITY', 684, 27, 13, 0, 4, 'Medium', 'https://www.linkedin.com/posts/christine-jewell-9361612a_one-of-the-greatest-limitations-we-face-isn-activity-7411759825501597696', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000027', 'I''m not a city girl', 'LinkedIn', 'Image', '2025-12-13', 'Personal, lifestyle', 'IDENTITY', 1007, 47, 11, 2, 5, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_im-not-a-city-girl-ill-choose-mountains-activity-7405310634529177600', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000028', 'In the 2018 NFL playoffs', 'LinkedIn', 'Image', '2025-12-02', 'Coaching tree, leadership', 'LEGACY', 1150, 28, 11, 1, 5, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_in-the-2018-nfl-playoffs-all-12-head-coaches-activity-7401625116285173761', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000029', 'Information is free', 'LinkedIn', 'Image', '2025-11-04', 'Information vs transformation', 'DIAGNOSE', 1318, 21, 22, 0, 6, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_information-is-free-transformation-is-expensive-activity-7391461052569530368', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000030', 'Why do you talk about marriage and relationships so much', 'LinkedIn', 'Image', '2025-11-10', 'Brand positioning, marriage', 'CONNECTION', 1015, 14, 13, 3, 5, 'High', 'https://www.linkedin.com/posts/christine-jewell-9361612a_why-do-you-talk-about-marriage-relationships-activity-7393660817688350721', '33333333-3333-3333-3333-000000000004'),
  ('66666666-6666-6666-6666-000000000031', 'Why Strong Men Stop Reaching', 'YouTube', 'Long-form Video', '2026-04-02', 'Why high-achieving men withdraw from their wives', 'CONNECTION', 24180, 312, 0, 27, 87, 'High', NULL, '33333333-3333-3333-3333-000000000005'),
  ('66666666-6666-6666-6666-000000000032', 'What She''s Not Saying', 'YouTube Short', 'Short', '2026-04-15', 'Reading what your wife isn''t saying', 'DIAGNOSE', 41200, 0, 0, 12, 33, 'Medium', NULL, '33333333-3333-3333-3333-000000000005'),
  ('66666666-6666-6666-6666-000000000033', 'Faith & Marriage Podcast Appearance', 'Podcast', 'Podcast Guest', '2026-04-08', 'Christine guesting on Faith & Marriage podcast', 'KINGDOM', 18000, 0, 0, 0, 41, 'High', NULL, '33333333-3333-3333-3333-000000000003'),
  ('66666666-6666-6666-6666-000000000034', 'The Connection Code (Lead Magnet)', 'Other', 'Article', '2025-12-01', 'CCS landing page, 4-part guide', 'CONNECTION', 3902, 0, 0, 0, 211, 'High', NULL, '33333333-3333-3333-3333-000000000002')
ON CONFLICT (id) DO NOTHING;

-- CHANNEL METRICS (weekly snapshots — 32 rows across 7 channels)
INSERT INTO public.channel_metrics (id, channel, snapshot_date, followers_subs, reach_28d, watch_time_hrs, avg_watch_time, ctr, open_rate, posts_episodes_released, net_change, notes)
VALUES
  ('77777777-7777-7777-7777-000000000001', 'YouTube', '2026-03-17', 3341, 9406, 99.7,  '0:51', 1.40, NULL, 1, NULL, 'Strong subs gain'),
  ('77777777-7777-7777-7777-000000000002', 'YouTube', '2026-03-24', 3328, 5423, 68.0,  '1:28', 2.40, NULL, 1, -13,  NULL),
  ('77777777-7777-7777-7777-000000000003', 'YouTube', '2026-03-31', 3352, 5140, 84.2,  '2:20', 4.20, NULL, 1, 24,   NULL),
  ('77777777-7777-7777-7777-000000000004', 'YouTube', '2026-04-07', 3362, 5251, 124.7, '3:14', 4.10, NULL, 0, 10,   NULL),
  ('77777777-7777-7777-7777-000000000005', 'YouTube', '2026-04-14', 3389, 4662, 235.2, '4:59', 4.90, NULL, 1, 27,   NULL),
  ('77777777-7777-7777-7777-000000000006', 'YouTube', '2026-04-21', 3492, 8352, 550.6, '5:08', 3.20, NULL, 1, 103,  '"Strong Men Stop Reaching" went viral'),
  ('77777777-7777-7777-7777-000000000007', 'LinkedIn', '2026-03-17', 9583,  NULL, NULL, NULL, NULL, NULL, 3, 87,  NULL),
  ('77777777-7777-7777-7777-000000000008', 'LinkedIn', '2026-03-24', 9676,  NULL, NULL, NULL, NULL, NULL, 2, 93,  NULL),
  ('77777777-7777-7777-7777-000000000009', 'LinkedIn', '2026-03-31', 9748,  NULL, NULL, NULL, NULL, NULL, 3, 72,  NULL),
  ('77777777-7777-7777-7777-000000000010', 'LinkedIn', '2026-04-07', 9928,  NULL, NULL, NULL, NULL, NULL, 4, 180, NULL),
  ('77777777-7777-7777-7777-000000000011', 'LinkedIn', '2026-04-14', 10157, NULL, NULL, NULL, NULL, NULL, 3, 229, NULL),
  ('77777777-7777-7777-7777-000000000012', 'LinkedIn', '2026-04-21', 10467, NULL, NULL, NULL, NULL, NULL, 4, 310, 'Strong week'),
  ('77777777-7777-7777-7777-000000000013', 'Instagram', '2026-03-17', 1273, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('77777777-7777-7777-7777-000000000014', 'Instagram', '2026-03-24', 1275, NULL, NULL, NULL, NULL, NULL, NULL, 2,    NULL),
  ('77777777-7777-7777-7777-000000000015', 'Instagram', '2026-03-31', 1292, NULL, NULL, NULL, NULL, NULL, NULL, 17,   NULL),
  ('77777777-7777-7777-7777-000000000016', 'Instagram', '2026-04-07', 1296, NULL, NULL, NULL, NULL, NULL, NULL, 4,    NULL),
  ('77777777-7777-7777-7777-000000000017', 'Instagram', '2026-04-14', 1300, NULL, NULL, NULL, NULL, NULL, NULL, 4,    NULL),
  ('77777777-7777-7777-7777-000000000018', 'Instagram', '2026-04-21', 1302, NULL, NULL, NULL, NULL, NULL, NULL, 2,    NULL),
  ('77777777-7777-7777-7777-000000000019', 'Podcast',  '2026-03-17', 950,  428, NULL, NULL, NULL, NULL, 1, NULL, NULL),
  ('77777777-7777-7777-7777-000000000020', 'Podcast',  '2026-03-24', 970,  300, NULL, NULL, NULL, NULL, 1, 20,   NULL),
  ('77777777-7777-7777-7777-000000000021', 'Podcast',  '2026-03-31', 990,  447, NULL, NULL, NULL, NULL, 1, 20,   NULL),
  ('77777777-7777-7777-7777-000000000022', 'Podcast',  '2026-04-07', 1010, 433, NULL, NULL, NULL, NULL, 1, 20,   NULL),
  ('77777777-7777-7777-7777-000000000023', 'Podcast',  '2026-04-14', 1025, 365, NULL, NULL, NULL, NULL, 1, 15,   NULL),
  ('77777777-7777-7777-7777-000000000024', 'Podcast',  '2026-04-21', 1035, 428, NULL, NULL, NULL, NULL, 1, 10,   NULL),
  ('77777777-7777-7777-7777-000000000025', 'Email/Kajabi', '2026-03-17', 1417, NULL, NULL, NULL, NULL, 22.10, 2, NULL, NULL),
  ('77777777-7777-7777-7777-000000000026', 'Email/Kajabi', '2026-03-24', 1418, NULL, NULL, NULL, NULL, 21.90, 2, 1,    NULL),
  ('77777777-7777-7777-7777-000000000027', 'Email/Kajabi', '2026-03-31', 1421, NULL, NULL, NULL, NULL, 22.00, 2, 3,    NULL),
  ('77777777-7777-7777-7777-000000000028', 'Email/Kajabi', '2026-04-07', 1423, NULL, NULL, NULL, NULL, 21.80, 2, 2,    NULL),
  ('77777777-7777-7777-7777-000000000029', 'Email/Kajabi', '2026-04-14', 1425, NULL, NULL, NULL, NULL, 21.70, 2, 2,    NULL),
  ('77777777-7777-7777-7777-000000000030', 'Email/Kajabi', '2026-04-21', 1450, NULL, NULL, NULL, NULL, 21.70, 2, 25,   'CCS push drove signups'),
  ('77777777-7777-7777-7777-000000000031', 'Facebook',  '2026-04-21', 82,  120, NULL, NULL, NULL, NULL, 0, 2, NULL),
  ('77777777-7777-7777-7777-000000000032', 'Twitter/X', '2026-04-21', 140, 85,  NULL, NULL, NULL, NULL, 0, 0, NULL)
ON CONFLICT (id) DO NOTHING;