<?php
/**
 * Medsuite-eT — Production Config Template (med-suit.shop)
 *
 * Copy this file to config.php and fill in your production credentials.
 * In CI/CD, config.php is generated automatically from GitHub secrets.
 */
return [
    'db_host'    => 'localhost',
    'db_port'    => '3306',
    'db_name'    => 'your_database_name',
    'db_user'    => 'your_database_user',
    'db_pass'    => 'your_database_password',
    'jwt_secret' => 'your-secret-key-change-in-production-must-be-at-least-32-chars',
];