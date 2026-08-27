<?php

namespace App\Rules;

use App\Services\LicenceIdentity;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Shape check for a PH driver's licence number.
 *
 * This is the ONLY automated check available: LTO publishes no verification
 * API, so nothing can confirm the licence actually exists or belongs to the
 * person holding the phone. Passing this means the number is plausibly
 * formatted — not that the driver is licensed.
 */
class PhilippineLicence implements ValidationRule
{
    public function __construct(private LicenceIdentity $identity = new LicenceIdentity) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! $this->identity->isWellFormed($value)) {
            $fail('Mali ang porma ng numero ng lisensya. Dapat katulad ng N01-19-123456.');
        }
    }
}
