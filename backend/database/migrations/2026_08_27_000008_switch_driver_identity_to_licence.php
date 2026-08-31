<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Moves driver identity from phone to licence + plate.
 *
 * The licence number itself stays hashed with bcrypt (unsearchable by design),
 * so logging in by licence needs a separate deterministic BLIND INDEX: an HMAC
 * of the normalised number keyed on the app key. It is searchable but not
 * reversible, and is never returned to any client.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('license_lookup', 64)->nullable()->unique()->after('license_hash');
            $table->date('license_expires_at')->nullable()->after('license_lookup');
        });

        // Phone is no longer the credential. Kept nullable so existing rows
        // survive and so a driver can still volunteer one later.
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['license_lookup', 'license_expires_at']);
        });
    }
};
