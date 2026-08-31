<?php

use App\Services\LicenceIdentity;
use Tests\TestCase;

// blindIndex() reads the app key from config.
uses(TestCase::class);

beforeEach(function () {
    $this->identity = new LicenceIdentity;
});

it('normalises any separator style to the canonical 3-2-6 form', function () {
    // A bare licence is ELEVEN characters (3 + 2 + 6), not nine — getting this
    // wrong silently skipped normalisation and broke login for typed input.
    foreach (['N01-19-123456', 'n01 19 123456', 'n0119123456', 'N01/19/123456', ' n01-19-123456 '] as $variant) {
        expect($this->identity->normalise($variant))->toBe('N01-19-123456');
    }
});

it('accepts a well-formed number and rejects malformed ones', function () {
    expect($this->identity->isWellFormed('N01-19-123456'))->toBeTrue()
        ->and($this->identity->isWellFormed('n0119123456'))->toBeTrue();

    foreach (['', 'bogus', '12345', 'N1-19-123456', 'N01-19-12345', 'N01-19-1234567', 'NN1-19-123456'] as $bad) {
        expect($this->identity->isWellFormed($bad))->toBeFalse();
    }
});

it('produces a deterministic, irreversible blind index', function () {
    $a = $this->identity->blindIndex('N01-19-123456');
    $b = $this->identity->blindIndex('n01 19 123456');

    expect($a)->toBe($b)
        ->and($a)->toHaveLength(64)
        ->and($a)->not->toContain('123456')
        ->and($this->identity->blindIndex('N01-19-123457'))->not->toBe($a);
});

it('leaves an unrecognisable value alone rather than mangling it', function () {
    expect($this->identity->normalise('bogus'))->toBe('BOGUS');
});
