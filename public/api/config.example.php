<?php
/**
 * Medsuite-eT API Configuration
 * Copy to config.php — never commit config.php
 *
 * Two drivers:
 *  - sqlite (VPS file mode, recommended): all data in one file on the VPS.
 *    Back up via GET /api/index.php?action=backup (JSON) or copy the file.
 *  - mysql (cPanel/shared hosting): classic MySQL backend.
 */
return [
    // 'sqlite' or 'mysql'
    'db_driver' => 'sqlite',

    // SQLite file (only used when db_driver is sqlite).
    // Keep it OUTSIDE the web root. VPS default: /var/www/med-data/med-suite.sqlite
    'db_path' => '/var/www/med-data/med-suite.sqlite',

    // MySQL (only used when db_driver is mysql)
    'db_host' => 'localhost',
    'db_port' => '3306',
    'db_name' => 'medsuite',
    'db_user' => 'root',
    'db_pass' => '',
    'jwt_secret' => 'change-this-to-a-long-random-string',
];
