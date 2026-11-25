/* ========================================
   Offline PlaceholderAPI catalog for the placeholder picker.

   Collected 2026-11-20 from:
     • https://wiki.placeholderapi.com/users/placeholder-list/minecraft/  (raw wiki markdown)
     • https://docs.phoenixdevt.fr/mmocore/general/placeholders
     • https://docs.phoenixdevt.fr/mythiclib/general/placeholders
     • plugin docs: LuckPerms, AuraSkills, CMI, Towny, Lands, FactionsUUID, BetterTeams
   Descriptions are short summaries, not copies of the docs.

   Format: "## Name | install hint" starts a group, "%placeholder% | description" is an
   entry, "VALUES <param>: a, b" lists known values for a parameter.
   <param> / [param] / (param) / {param} parts are filled in by the user.
   ======================================== */
(function () {
    'use strict';

    const RAW = String.raw`
## ⭐ Basic HUD | Player + Server expansions: /papi ecloud download Player · /papi ecloud download Server
%player_health% | Current health
%player_health_rounded% | Current health, rounded
%player_max_health% | Max health
%player_max_health_rounded% | Max health, rounded
%player_absorption% | Absorption (golden hearts)
%player_food_level% | Food level (0–20)
%player_saturation% | Saturation
%player_remaining_air% | Remaining air
%player_max_air% | Max air
%player_level% | XP level
%player_exp% | XP progress to next level
%player_current_exp% | Current XP points
%player_exp_to_level% | XP needed for next level
%player_total_exp% | Total XP
%player_name% | Player name
%player_displayname% | Display name
%player_ping% | Ping (ms)
%player_x% | X coordinate
%player_y% | Y coordinate
%player_z% | Z coordinate
%player_world% | World name
%player_biome% | Biome
%player_direction% | Facing direction
%player_gamemode% | Game mode
%player_world_time_24% | World time, 24-hour
%server_online% | Online players
%server_max_players% | Max players
%server_tps_1% | TPS (1 min)
%localtime_time% | Real-world local time
%vault_eco_balance_formatted% | Money, formatted
%playerpoints_points% | Player points

## Player | /papi ecloud download Player
%player_allow_flight% | Whether player can fly
%player_armor_helmet_name% | Helmet item name
%player_armor_helmet_data% | Helmet item data value
%player_armor_helmet_durability% | Helmet durability
%player_armor_chestplate_name% | Chestplate item name
%player_armor_chestplate_data% | Chestplate item data value
%player_armor_chestplate_durability% | Chestplate durability
%player_armor_leggings_name% | Leggings item name
%player_armor_leggings_data% | Leggings item data value
%player_armor_leggings_durability% | Leggings durability
%player_armor_boots_name% | Boots item name
%player_armor_boots_data% | Boots item data value
%player_armor_boots_durability% | Boots durability
%player_bed_x% | Bed spawn X
%player_bed_y% | Bed spawn Y
%player_bed_z% | Bed spawn Z
%player_bed_world% | Bed spawn world
%player_biome% | Biome at player location
%player_biome_capitalized% | Biome, capitalized
%player_block_underneath% | Block under player
%player_can_pickup_items% | Can pick up items
%player_colored_ping% | Ping, coloured
%player_compass_world% | Compass target world
%player_compass_x% | Compass target X
%player_compass_y% | Compass target Y
%player_compass_z% | Compass target Z
%player_custom_name% | Custom name
%player_current_exp% | Current XP points
%player_direction% | Compass direction facing
%player_direction_xz% | Direction on XZ plane
%player_displayname% | Display name
%player_list_name% | Tab list name
%player_exp% | XP progress to next level
%player_exp_to_level% | XP needed for next level
%player_first_join_date% | First join date
%player_first_played% | First played timestamp
%player_first_join% | First join timestamp
%player_first_played_formatted% | First played, formatted
%player_fly_speed% | Fly speed
%player_food_level% | Food level
%player_gamemode% | Game mode
%player_has_empty_slot% | Inventory has empty slot
%player_has_played_before% | Has played before
%player_empty_slots% | Empty inventory slots
%player_has_health_boost% | Has health boost
%player_has_potioneffect_<effect>% | Has potion effect
%player_has_permission_<permission>% | Has permission
%player_health% | Current health
%player_health_boost% | Health boost amount
%player_health_rounded% | Health, rounded
%player_health_scale% | Health scale
%player_online% | Is online
%player_is_flying% | Is flying
%player_is_sneaking% | Is sneaking
%player_is_sprinting% | Is sprinting
%player_is_sleeping% | Is sleeping
%player_is_inside_vehicle% | Is inside a vehicle
%player_is_op% | Is operator
%player_item_in_hand% | Item in main hand
%player_item_in_hand_name% | Main hand item name
%player_item_in_hand_data% | Main hand item data
%player_item_in_hand_durability% | Main hand item durability
%player_item_in_hand_level_<enchantment>% | Main hand enchantment level
%player_item_in_offhand% | Item in offhand
%player_item_in_offhand_name% | Offhand item name
%player_item_in_offhand_data% | Offhand item data
%player_item_in_offhand_durability% | Offhand item durability
%player_item_in_offhand_level_<enchantment>% | Offhand enchantment level
%player_locale% | Client locale
%player_locale_short% | Short locale code
%player_last_damage% | Last damage taken
%player_last_played_formatted% | Last played, formatted
%player_last_join_date% | Last join date
%player_level% | XP level
%player_light_level% | Light level at player
%player_max_air% | Max air
%player_max_health% | Max health
%player_max_health_rounded% | Max health, rounded
%player_minutes_lived% | Minutes lived
%player_name% | Player name
%player_ping% | Ping
%player_ping_<playername>% | Ping of another player
%player_remaining_air% | Remaining air
%player_saturation% | Saturation
%player_seconds_lived% | Seconds lived
%player_ticks_lived% | Ticks lived
%player_time% | Player time
%player_total_exp% | Total XP
%player_uuid% | Player UUID
%player_walk_speed% | Walk speed
%player_world% | World name
%player_world_type% | World type
%player_world_time_12% | World time, 12-hour
%player_world_time_24% | World time, 24-hour
%player_x% | X coordinate
%player_y% | Y coordinate
%player_z% | Z coordinate
%player_yaw% | Yaw rotation
%player_pitch% | Pitch rotation
%player_absorption% | Absorption health

## Server | /papi ecloud download Server
%server_name% | Server name
%server_online% | Online player count
%server_online_<world>% | Online players in a world
%server_max_players% | Max player slots
%server_unique_joins% | Unique joins
%server_version% | Server version
%server_uptime% | Uptime
%server_tps% | TPS
%server_tps_1% | TPS, 1 minute
%server_tps_5% | TPS, 5 minutes
%server_tps_15% | TPS, 15 minutes
%server_tps_1_colored% | TPS 1 min, coloured
%server_ram_used% | RAM used
%server_ram_free% | RAM free
%server_ram_total% | RAM total
%server_ram_max% | RAM max
%server_has_whitelist% | Whitelist enabled
%server_total_chunks% | Loaded chunks
%server_total_entities% | Total entities
%server_total_living_entities% | Living entities
%server_time_<SimpleDateFormat>% | Server time, custom format
%server_countdown_<SimpleDateFormat>_<time>% | Countdown to a date

## LocalTime | /papi ecloud download LocalTime
%localtime_time% | Current local time
%localtime_time_<SimpleDateFormat>% | Local time, custom format
%localtime_timezone_<TimeZoneID>% | Time in a timezone
%localtime_timezone_<TimeZoneID>,<SimpleDateFormat>% | Timezone time, custom format

## Statistic | /papi ecloud download Statistic
%statistic_deaths% | Deaths
%statistic_player_kills% | Player kills
%statistic_mob_kills% | Mob kills
%statistic_mine_block% | Blocks mined
%statistic_mine_block:<material>% | Times a block was mined
%statistic_kill_entity:<MobType>% | Times a mob was killed
%statistic_entity_killed_by:<MobType>% | Times killed by a mob
%statistic_use_item:<Item Material>% | Times an item was used
%statistic_craft_item:<Item Material>% | Times an item was crafted
%statistic_break_item:<Item Material>% | Times an item broke
%statistic_time_played% | Time played
%statistic_hours_played% | Hours played
%statistic_minutes_played% | Minutes played
%statistic_days_played% | Days played
%statistic_time_since_death% | Time since last death
%statistic_damage_dealt% | Damage dealt
%statistic_damage_taken% | Damage taken
%statistic_jump% | Jumps
%statistic_walk_one_cm% | Distance walked
%statistic_sprint_one_cm% | Distance sprinted
%statistic_fly_one_cm% | Distance flown
%statistic_aviate_one_cm% | Distance by elytra
%statistic_fish_caught% | Fish caught
%statistic_animals_bred% | Animals bred
%statistic_chest_opened% | Chests opened
%statistic_item_enchanted% | Items enchanted
%statistic_traded_with_villager% | Villager trades
%statistic_<StatisticType>% | Any Bukkit statistic

## World | /papi ecloud download World
%world_biome% | Biome at location
%world_total% | Worlds loaded
%world_players_<world>% | Players in a world
%world_time_<world>% | World time
%world_timein12_<world>% | World time, 12-hour
%world_difficulty_<world>% | World difficulty
%world_canpvp_<world>% | PvP allowed
%world_thunder_<world>% | Thunder active
%world_nearbyEntities_<radius>% | Entities near player
%world_seed_<world>% | World seed

## Math | /papi ecloud download Math
%math_<expression>% | Evaluate math, e.g. {player_health}*5
%math_[precision]:[rounding]_<expression>% | Math with precision / rounding

## ParseOther | /papi ecloud download ParseOther
%parseother_{username}_{placeholder}% | Placeholder of another player (no %)
%parseother_unsafe_{placeholder_for_username}_{placeholder}% | Same, player from a placeholder (party HUDs)

## Formatter | /papi ecloud download Formatter
%formatter_number_format_<number>% | Format a number
%formatter_number_format_[locale]:[pattern]_<number>% | Format with locale + pattern
%formatter_number_round_<number>% | Round a number
%formatter_number_round_[precision]:[roundingmode]_<number>% | Round with precision
%formatter_number_shorten_<number>% | Shorten (1.2k, 3.4M)
%formatter_number_time_<number>% | Number as time
%formatter_number_time_<timeunit>_<number>% | Number as time, unit
%formatter_number_from:<timeunit>_to:<timeunit>_<number>% | Convert time units
%formatter_text_uppercase_<text>% | Uppercase text
%formatter_text_lowercase_<text>% | Lowercase text
%formatter_text_capitalize_<text>% | Capitalize text
%formatter_text_replace_[target]_[replacement]_<text>% | Replace text
%formatter_text_substring_[start]:[end]_<text>% | Substring
%formatter_text_length_<text>% | Text length

## Progress | /papi ecloud download Progress
%progress_bar_{placeholder}% | Text progress bar of a value
%progress_bar_{placeholder}_m:<max value>% | Progress bar with max value
%progress_bar_{placeholder}_l:<max length>% | Progress bar length
%progress_bar_{placeholder}_c:<completed Symbol>% | Completed symbol
%progress_bar_{placeholder}_r:<remaining Symbol>% | Remaining symbol

## String | /papi ecloud download String
%string_uppercase_<string>% | Uppercase
%string_lowercase_<string>% | Lowercase
%string_capitalize_<string>% | Capitalize
%string_length_<string>% | Length
%string_substring_<startIndex>,<endIndex>_<string>% | Substring
%string_equals_<string>_<match>% | Equals check
%string_contains_<string>_<match>% | Contains check
%string_random_<string1>,<string2>,<string3>% | Random item from list
%string_trim_<string>% | Trim spaces

## ChangeOutput | /papi ecloud download ChangeOutput
%changeoutput_<options>_input:<input>_matcher:<matcher>_ifmatch:<output>_else:<output>% | If value matches → output A, else B

## RNG | /papi ecloud download RNG
%rng_random% | Random number
%rng_<minimum>,<maximum>% | Random number in range
%rng_online_player% | Random online player

## Bungee / Pinger | /papi ecloud download Bungee · /papi ecloud download Pinger
%bungee_total% | Players on the whole network
%bungee_<servername>% | Players on one server
%pinger_online_<host:port>% | Online players of a server
%pinger_max_<host:port>% | Max players of a server
%pinger_isonline_<host:port>% | Is the server online
%pinger_motd_<host:port>% | Server MOTD

## CheckItem | /papi ecloud download CheckItem
%checkitem_<modifier1>,<modifier2>% | Has a matching item
%checkitem_amount_<modifier1>,<modifier2>% | Amount of matching items
%checkitem_getinfo:<slot>_<modifier1>% | Info of item in slot

## MMOCore | built into MMOCore
%mmocore_level% | Main class level
%mmocore_level_percent% | Progress to next level (%)
%mmocore_experience% | Class XP
%mmocore_next_level% | XP needed for next level
%mmocore_class% | Class name
%mmocore_class_id% | Class internal ID
%mmocore_health% | Health, formatted
%mmocore_mana% | Mana, formatted
%mmocore_stamina% | Stamina, formatted
%mmocore_stellium% | Stellium, formatted
%mmocore_health_bar% | Health as a text bar
%mmocore_mana_bar% | Mana as a text bar
%mmocore_stamina_bar% | Stamina as a text bar
%mmocore_stellium_bar% | Stellium as a text bar
%mmocore_max_health% | Max health
%mmocore_mana_icon% | Mana icon of the class
%mmocore_mana_name% | Mana name of the class
%mmocore_stat_<stat_name>% | Stat value, formatted
%mmocore_attribute_<attribute>% | Attribute value
%mmocore_attribute_points% | Attribute points
%mmocore_attribute_reallocation_points% | Reallocation points
%mmocore_attribute_points_spent_<attribute_id>% | Points spent on an attribute
%mmocore_skill_points% | Skill points
%mmocore_class_points% | Class points
%mmocore_skill_tree_points_<tree>% | Unspent skill-tree points
%mmocore_skill_level_<skill_name>% | Level of a skill
%mmocore_bound_<slot_idx>% | Skill bound to a slot
%mmocore_id_bound_<slot_idx>% | Skill ID bound to a slot
%mmocore_cooldown_bound_<slot_idx>% | Cooldown of the bound skill
%mmocore_passive_bound_<slot_idx>% | Bound skill is passive
%mmocore_is_casting% | Is casting
%mmocore_profession_<profession>% | Profession level
%mmocore_profession_experience_<profession>% | Profession XP
%mmocore_profession_next_level_<profession>% | XP for next profession level
%mmocore_profession_percent_<profession>% | Profession progress (%)
%mmocore_exp_multiplier_<profession>% | XP multiplier
%mmocore_exp_boost_<profession>% | XP booster multiplier
%mmocore_party_count% | Party member count
%mmocore_party_member_<n>% | Name of party member n
%mmocore_guild_name% | Guild name
%mmocore_guild_tag% | Guild tag
%mmocore_guild_leader% | Guild leader
%mmocore_guild_members% | Guild members
%mmocore_guild_online_members% | Guild online members
%mmocore_online_friends% | Online friends
%mmocore_online_friend_<n>% | Name of online friend n
%mmocore_quest% | Current quest
%mmocore_quest_progress% | Quest progress
%mmocore_quest_objective% | Quest objective
%mmocore_in_combat% | In combat
%mmocore_pvp_mode% | PvP mode on
%mmocore_combat_left% | Time until combat ends
%mmocore_since_last_hit% | Seconds since last hit
%mmocore_invulnerability_left% | Invulnerability time left
VALUES <profession>: mining, alchemy, fishing, enchanting, smithing, main
VALUES <stat_name>: MAX_HEALTH, MAX_MANA, MAX_STAMINA, MANA_REGENERATION, DEFENSE, ATTACK_DAMAGE, CRITICAL_STRIKE_CHANCE, MOVEMENT_SPEED
VALUES <tree>: global

## MythicLib | built into MythicLib
%mythiclib_stat_<stat_name>% | Stat value
%mythiclib_raw_stat_<stat_name>% | Stat value, unrounded
%mythiclib_cooldown_<cooldown_key>% | Cooldown remaining
%mythiclib_defense_damage_reduction% | Damage reduced by defense
%mythiclib_mana% | Mana (built-in mana module)
%mythiclib_stamina% | Stamina (built-in mana module)
%mythiclib_mana_bar% | Mana as a text bar
%mythiclib_stamina_bar% | Stamina as a text bar
%mythiclib_space_<number>% | Positive / negative font space
VALUES <stat_name>: MAX_HEALTH, MAX_MANA, MAX_STAMINA, MANA_REGENERATION, STAMINA_REGENERATION, DEFENSE, ATTACK_DAMAGE, CRITICAL_STRIKE_CHANCE, CRITICAL_STRIKE_POWER, DODGE_RATING, BLOCK_RATING, PARRY_RATING, MOVEMENT_SPEED, MAX_HEALTH_PERCENT
VALUES <cooldown_key>: dodge, parry, block, weapon_crit, skill_crit, skill_<skill_id>, mmoitem_<item_id>

## AuraSkills | built into AuraSkills
%auraskills_power% | Total skill level
%auraskills_[skill]% | Level of a skill
%auraskills_average% | Average skill level
%auraskills_hp% | Current HP
%auraskills_hp_max% | Max HP
%auraskills_hp_percent% | HP percent
%auraskills_mana% | Current mana
%auraskills_mana_int% | Current mana, integer
%auraskills_mana_max% | Max mana
%auraskills_mana_max_int% | Max mana, integer
%auraskills_rank% | Power leaderboard rank
%auraskills_rank_[skill]% | Skill leaderboard rank
%auraskills_xp_[skill]% | Skill XP
%auraskills_xp_formatted_[skill]% | Skill XP, formatted
%auraskills_xp_required_[skill]% | XP for next skill level
%auraskills_xp_progress_1_[skill]% | Skill progress (%)
%auraskills_xp_bar_[skill]% | Skill progress text bar
%auraskills_multiplier% | XP multiplier
%auraskills_mability_[ability]_active% | Mana ability active
%auraskills_mability_[ability]_cost% | Mana ability cost
VALUES [skill]: farming, foraging, mining, fishing, excavation, archery, defense, fighting, endurance, agility, alchemy, enchanting, sorcery, healing, forging

## mcMMO | built into mcMMO
%mcmmo_power_level% | Power level
%mcmmo_power_level_cap% | Power level cap
%mcmmo_level_<skillname>% | Skill level
%mcmmo_rank_<skillname>% | Skill rank
%mcmmo_xp_<skillname>% | Skill XP
%mcmmo_xp_needed_<skillname>% | XP for next level
%mcmmo_xp_remaining_<skillname>% | XP remaining
%mcmmo_xprate% | Global XP rate
%mcmmo_is_xp_event_active% | XP event active
%mcmmo_in_party% | In a party
%mcmmo_party_name% | Party name
%mcmmo_party_leader% | Party leader
%mcmmo_party_size% | Party size
VALUES <skillname>: mining, woodcutting, herbalism, excavation, fishing, unarmed, archery, swords, axes, acrobatics, repair, alchemy, taming, tridents, crossbows, maces

## Vault (money / rank) | /papi ecloud download Vault
%vault_eco_balance% | Balance
%vault_eco_balance_formatted% | Balance, formatted
%vault_eco_balance_commas% | Balance with commas
%vault_eco_balance_fixed% | Balance, no decimals
%vault_eco_balance_<number>dp% | Balance with N decimals
%vault_group% | Primary group
%vault_group_capital% | Primary group, capitalized
%vault_groups% | All groups
%vault_prefix% | Prefix
%vault_suffix% | Suffix
%vault_groupprefix% | Group prefix
%vault_groupsuffix% | Group suffix
%vault_hasgroup_<group>% | Has group

## LuckPerms | /papi ecloud download LuckPerms
%luckperms_prefix% | Prefix
%luckperms_suffix% | Suffix
%luckperms_primary_group_name% | Primary group
%luckperms_groups% | Groups
%luckperms_highest_group_by_weight% | Highest group by weight
%luckperms_meta_<meta key>% | Meta value
%luckperms_prefix_element_<element>% | Prefix from meta stack
%luckperms_in_group_<group>% | Directly in group
%luckperms_inherits_group_<group>% | In group (inherited too)
%luckperms_has_permission_<permission>% | Has permission
%luckperms_expiry_time_<permission>% | Temp permission time left
%luckperms_group_expiry_time_<group name>% | Temp group time left
%luckperms_current_group_on_track_<track>% | Current group on track
%luckperms_next_group_on_track_<track>% | Next group on track

## PlayerPoints / TokenManager / MobCoins | built into the plugins · LemonMobCoins: /papi ecloud download LemonMobCoins
%playerpoints_points% | Points
%playerpoints_points_formatted% | Points, formatted
%playerpoints_points_shorthand% | Points, short (1.2k)
%tm_tokens% | Tokens
%tm_tokens_formatted% | Tokens, formatted
%tm_rank% | Token leaderboard rank
%lemonmobcoins_balance% | MobCoins
%lemonmobcoins_balance_formatted% | MobCoins, formatted

## EssentialsX | /papi ecloud download Essentials
%essentials_nickname% | Nickname
%essentials_nickname_stripped% | Nickname, no colours
%essentials_afk% | Is AFK
%essentials_fly% | Fly mode
%essentials_godmode% | God mode
%essentials_vanished% | Vanished
%essentials_muted% | Muted
%essentials_homes_set% | Homes set
%essentials_homes_max% | Max homes
%essentials_baltop_rank% | Baltop rank
%essentials_baltop_player_<rank>% | Baltop player at rank
%essentials_baltop_balance_formatted_<rank>% | Baltop balance at rank
%essentials_kit_time_until_available_<kitname>% | Kit cooldown
%essentials_worth% | Worth of held item

## CMI | built into CMI
%cmi_user_balance% | Balance
%cmi_user_balance_formatted% | Balance, formatted
%cmi_user_prefix% | Prefix
%cmi_user_suffix% | Suffix
%cmi_user_group% | Group
%cmi_user_rank_name% | Rank
%cmi_user_nextrankpercent% | Progress to next rank (%)
%cmi_user_level% | Level
%cmi_user_exp% | XP
%cmi_user_playtime_formatted% | Playtime
%cmi_user_votecount% | Votes
%cmi_user_nickname% | Nickname
%cmi_user_homeamount% | Homes
%cmi_user_maxhomes% | Max homes
%cmi_baltop_name_[1-10]% | Baltop name at place
%cmi_baltop_money_[1-10]% | Baltop money at place
%cmi_server_online% | Online players
%cmi_tps_1% | TPS

## Parties | built into Parties
%parties_party% | Party name
%parties_desc% | Party description
%parties_motd% | Party MOTD
%parties_kills% | Party kills
%parties_rank_name% | Rank in party
%parties_color_code% | Party colour code

## Towny | built into Towny
%townyadvanced_town% | Town
%townyadvanced_town_formatted% | Town, long name
%townyadvanced_nation% | Nation
%townyadvanced_towny_tag% | Town + nation tags
%townyadvanced_player_status% | Nomad / Resident / Mayor / King
%townyadvanced_town_balance% | Town bank
%townyadvanced_nation_balance% | Nation bank
%townyadvanced_town_residents_online% | Residents online
%townyadvanced_player_location_town_or_wildname% | Town or wilderness here
%townyadvanced_player_location_pvp% | PvP here
%townyadvanced_time_until_new_day_formatted% | Time until new day

## Lands | built into Lands
%lands_land_name% | Land name
%lands_land_name_here% | Land at your location
%lands_land_owner% | Land owner
%lands_land_role_name% | Your role
%lands_land_balance% | Land bank
%lands_land_balance_short% | Land bank, short
%lands_land_chunks% | Claimed chunks
%lands_land_chunks_max% | Max chunks
%lands_land_level% | Land level
%lands_nation_name% | Nation
%lands_combat-tag% | Combat tag
%lands_war_state% | War state

## FactionsUUID | built into FactionsUUID
%factionsuuid_faction_name% | Faction name
%factionsuuid_faction_leader% | Faction leader
%factionsuuid_faction_power% | Faction power
%factionsuuid_faction_powermax% | Faction max power
%factionsuuid_faction_claims% | Claims
%factionsuuid_faction_online% | Members online
%factionsuuid_faction_bank_balance% | Faction bank
%factionsuuid_player_role_name% | Your role
%factionsuuid_player_power% | Your power
%factionsuuid_player_kills% | Your kills

## Skyblock (BentoBox / SuperiorSkyblock2) | BentoBox built in · SuperiorSkyblock2 built in
%[gamemode]_island_name% | Island name (gamemode: bskyblock, aoneblock…)
%[gamemode]_island_owner% | Island owner
%[gamemode]_island_protection_range% | Protection range
%Level_[gamemode]_island_level% | Island level (Level add-on)
%superior_island_level% | Island level (SuperiorSkyblock2, seen in HUD packs)
VALUES [gamemode]: bskyblock, aoneblock, acidisland, caveblock, skygrid

## Jobs / Quests / Teams | built into Jobs Reborn and BetterTeams · Quests: /papi ecloud download Quests
%jobsr_user_points% | Jobs points
%jobsr_user_totallevels% | Total job levels
%jobsr_user_jlevel_(jname/number)% | Job level
%jobsr_user_jexp_(jname/number)% | Job XP
%jobsr_user_jmaxexp_(jname/number)% | Job XP needed
%quests_player_quest_points% | Quest points
%quests_player_current_quest_names% | Active quests
%quests_player_current_quest_amount% | Active quest count
%betterteams_name% | Team name
%betterteams_tag% | Team tag
%betterteams_rank% | Your team rank
%betterteams_online% | Team members online
%betterteams_money% | Team balance
%betterteams_level% | Team level

## Combat / Voting | built into CombatLogX · VotingPlugin: /papi ecloud download VotingPlugin
%combatlogx_in_combat% | In combat
%combatlogx_time_left% | Combat time left
%combatlogx_enemy_name% | Enemy name
%combatlogx_enemy_health_rounded% | Enemy health
%VotingPlugin_total% | Total votes
%VotingPlugin_Points% | Vote points
%VotingPlugin_DailyVoteStreak% | Daily vote streak
%VotingPlugin_CanVote% | Can vote now
%VotingPlugin_VotePartyVotesNeeded% | Votes needed for vote party
`;

    /** Bars need a value and a max: suggested max for common values */
    const BAR_MAX = {
        '%player_health%': '%player_max_health%',
        '%player_health_rounded%': '%player_max_health_rounded%',
        '%player_absorption%': '%player_max_health%',
        '%player_food_level%': '20',
        '%player_saturation%': '20',
        '%player_remaining_air%': '%player_max_air%',
        '%player_exp%': '1',
        '%player_current_exp%': '%player_exp_to_level%',
        '%mmocore_experience%': '%mmocore_next_level%',
        '%mmocore_mana%': '%mmocore_stat_max_mana%',
        '%mmocore_stamina%': '%mmocore_stat_max_stamina%',
        '%mmocore_stellium%': '%mmocore_stat_max_stellium%',
        '%mmocore_health%': '%mmocore_max_health%',
        '%mmocore_level_percent%': '100',
        '%mythiclib_mana%': '%mythiclib_stat_max_mana%',
        '%mythiclib_stamina%': '%mythiclib_stat_max_stamina%',
        '%auraskills_mana%': '%auraskills_mana_max%',
        '%auraskills_mana_int%': '%auraskills_mana_max_int%',
        '%auraskills_hp%': '%auraskills_hp_max%',
        '%auraskills_hp_percent%': '100',
    };

    function parse(raw) {
        const groups = [];
        let g = null;
        for (const line0 of raw.split('\n')) {
            const line = line0.trim();
            if (!line) continue;
            if (line.startsWith('## ')) {
                const [name, install] = line.slice(3).split(' | ');
                g = { name: name.trim(), install: (install || '').trim(), items: [], values: {} };
                groups.push(g);
            } else if (g && line.startsWith('VALUES ')) {
                const i = line.indexOf(':');
                g.values[line.slice(7, i).trim()] = line.slice(i + 1).split(',').map((s) => s.trim()).filter(Boolean);
            } else if (g && line.startsWith('%')) {
                const i = line.indexOf(' | ');
                const p = i < 0 ? line : line.slice(0, i).trim();
                g.items.push({ p, d: i < 0 ? '' : line.slice(i + 3).trim(), max: BAR_MAX[p] || '' });
            }
        }
        return groups;
    }

    window.PAPI_CATALOG = parse(RAW);
})();
