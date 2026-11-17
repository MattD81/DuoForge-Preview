<?php
declare(strict_types=1);

namespace App\Scene;

use JumPHP\Renderer\Renderer;
use JumPHP\Scene\AbstractScene;

/**
 * Neonräven Turbo (JumPHP edition).
 * Retro-native scene that runs under the official JumPHP runtime once built.
 * No external assets, copyrighted characters, network calls or blocking loops.
 */
final class TurboScene extends AbstractScene
{
    private const STAGE_NAMES = ['NEON HARBOR', 'CRYSTAL RIDGE', 'STORM FACTORY', 'MIDNIGHT LINE', 'CORE FORTRESS'];
    private const COLORS = [
        ['#111333','#252a60','#f08a76','#83f5d6'],
        ['#171431','#57417c','#ffa76d','#f0a3fc'],
        ['#102132','#285878','#83b3cd','#8bf6dc'],
        ['#0d112e','#2d386a','#ac7bb0','#b8b0ff'],
        ['#231129','#6c324e','#fa6b6b','#ffd481'],
    ];

    private string $state = 'menu';
    private int $stage = 0;
    private int $score = 0;
    private int $ringsHeld = 0;
    private int $lives = 3;
    private float $time = 0.0;
    private float $px = 32.0;
    private float $py = 130.0;
    private float $vx = 0.0;
    private float $vy = 0.0;
    private float $camera = 0.0;
    private float $invuln = 0.0;
    private float $dashTime = 0.0;
    private float $dashCooldown = 0.0;
    private float $checkpoint = 32.0;
    private int $facing = 1;
    private int $worldWidth = 2080;
    private bool $grounded = true;
    private float $coyote = 0.0;
    /** @var list<array{x: float, y: float, on: bool}> */
    private array $rings = [];
    /** @var list<array{x: float, anchor: float, alive: bool, phase: float}> */
    private array $bots = [];
    /** @var list<array{x: float, y: float, w: float}> */
    private array $platforms = [];
    /** @var list<array{0: float, 1: float}> */
    private array $pits = [];
    private float $checkpointFx = 0.0;

    public function enter(array $params = []): void
    {
        $this->resetAll();
        if (($params['demo'] ?? false) === true) {
            $this->state = 'playing';
        }
    }

    private function resetAll(): void
    {
        $this->stage = 0;
        $this->score = 0;
        $this->ringsHeld = 0;
        $this->lives = 3;
        $this->startStage(0);
        $this->state = 'menu';
    }

    private function startStage(int $index): void
    {
        $this->stage = $index;
        $this->time = 0.0;
        $this->px = 32.0;
        $this->py = 130.0;
        $this->vx = 0.0;
        $this->vy = 0.0;
        $this->camera = 0.0;
        $this->invuln = 0.8;
        $this->dashTime = 0.0;
        $this->dashCooldown = 0.0;
        $this->checkpoint = 32.0;
        $this->facing = 1;
        $this->grounded = true;
        $this->worldWidth = 2080 + $index * 150;
        $this->pits = [[580.0, 644.0], [1300.0, 1372.0]];
        if ($index > 1) {
            $this->pits[] = [1750.0, 1818.0];
        }
        $this->platforms = [];
        for ($x = 330; $x < $this->worldWidth - 120; $x += 280) {
            $this->platforms[] = ['x' => (float)$x, 'y' => 105.0 - (($x / 280) % 2) * 13.0, 'w' => 76.0];
        }
        $this->rings = [];
        for ($x = 88; $x < $this->worldWidth - 92; $x += 31) {
            if ($this->floorAt((float)$x) === null) {
                continue;
            }
            $arch = sin((float)($x % 300) / 300 * M_PI) * 15.0;
            $this->rings[] = ['x' => (float)$x, 'y' => 108.0 - $arch, 'on' => true];
        }
        foreach ($this->pits as [$a, $b]) {
            $this->rings[] = ['x' => ($a + $b) / 2, 'y' => 91.0, 'on' => true];
            $this->platforms[] = ['x' => $a + 12, 'y' => 118.0, 'w' => $b - $a - 23];
        }
        $this->bots = [];
        foreach ([410, 830, 1200, 1580, 1900, 2200, 2450] as $x) {
            if ($x >= $this->worldWidth - 180 || $this->floorAt((float)$x) === null) {
                continue;
            }
            $this->bots[] = ['x' => (float)$x, 'anchor' => (float)$x, 'alive' => true, 'phase' => (float)($x % 6)];
        }
    }

    private function floorAt(float $x): ?float
    {
        foreach ($this->pits as [$a, $b]) {
            if ($x > $a && $x < $b) {
                return null;
            }
        }
        return 146.0;
    }

    private function damage(): void
    {
        if ($this->invuln > 0.0) {
            return;
        }
        if ($this->ringsHeld > 0) {
            $this->ringsHeld = max(0, $this->ringsHeld - 10);
            $this->vx = (float)(-$this->facing * 100);
            $this->vy = -120.0;
            $this->invuln = 1.3;
        } else {
            $this->respawn();
        }
    }

    private function respawn(): void
    {
        $this->lives--;
        if ($this->lives <= 0) {
            $this->state = 'dead';
            return;
        }
        $this->px = $this->checkpoint;
        $this->py = 130.0;
        $this->vx = 0.0;
        $this->vy = 0.0;
        $this->invuln = 1.5;
    }

    public function update(float $dt): void
    {
        $dt = max(0.0, min(0.034, $dt));
        if ($this->state === 'menu' || $this->state === 'dead' || $this->state === 'victory') {
            if ($this->actions()->isPressed('confirm') || $this->actions()->isPressed('jump')) {
                $this->resetAll();
                $this->state = 'playing';
            }
            return;
        }
        if ($this->state === 'between') {
            if ($this->actions()->isPressed('confirm') || $this->actions()->isPressed('jump')) {
                $this->startStage($this->stage + 1);
                $this->state = 'playing';
            }
            return;
        }

        $this->time += $dt;
        $axis = $this->actions()->axis('left', 'right');
        $this->dashCooldown = max(0.0, $this->dashCooldown - $dt);
        $this->dashTime = max(0.0, $this->dashTime - $dt);
        $this->invuln = max(0.0, $this->invuln - $dt);

        if ($axis !== 0) {
            $this->facing = $axis > 0 ? 1 : -1;
            $this->vx += $axis * ($this->grounded ? 480.0 : 330.0) * $dt;
        } else if ($this->dashTime <= 0.0) {
            $decel = ($this->grounded ? 580.0 : 130.0) * $dt;
            $this->vx = max(0.0, abs($this->vx) - $decel) * ($this->vx >= 0.0 ? 1 : -1);
        }
        if ($this->actions()->isPressed('dash') && $this->dashCooldown <= 0.0) {
            $this->dashTime = 0.17;
            $this->dashCooldown = 0.75;
            $this->vx = $this->facing * 340.0;
            $this->vy = min(0.0, $this->vy);
        }
        $maxSpeed = $this->dashTime > 0.0 ? 340.0 : 186.0;
        $this->vx = max(-$maxSpeed, min($maxSpeed, $this->vx));
        if ($this->grounded) {
            $this->coyote = 0.09;
        } else {
            $this->coyote = max(0.0, $this->coyote - $dt);
        }
        if ($this->actions()->isPressed('jump') && $this->coyote > 0.0) {
            $this->vy = -245.0;
            $this->grounded = false;
            $this->coyote = 0.0;
        }
        $this->vy = min(500.0, $this->vy + 720.0 * $dt);
        $oldBottom = $this->py + 10.0;
        $this->px = max(10.0, min((float)($this->worldWidth - 10), $this->px + $this->vx * $dt));
        $this->py += $this->vy * $dt;
        $newBottom = $this->py + 10.0;
        $this->grounded = false;

        if ($this->vy >= 0.0) {
            $ground = $this->floorAt($this->px);
            $landing = $ground !== null && $oldBottom <= $ground + 6 && $newBottom >= $ground ? $ground : INF;
            foreach ($this->platforms as $platform) {
                if ($this->px + 9 > $platform['x'] && $this->px - 9 < $platform['x'] + $platform['w']
                    && $oldBottom <= $platform['y'] + 7 && $newBottom >= $platform['y']) {
                    $landing = min($landing, $platform['y']);
                }
            }
            if (is_finite($landing)) {
                $this->py = $landing - 10;
                $this->vy = 0.0;
                $this->grounded = true;
            }
        }
        foreach ($this->rings as &$ring) {
            if ($ring['on'] && abs($ring['x'] - $this->px) < 14 && abs($ring['y'] - $this->py) < 16) {
                $ring['on'] = false;
                $this->ringsHeld++;
                $this->score += 100;
            }
        }
        unset($ring);

        foreach ($this->bots as &$bot) {
            if (!$bot['alive']) {
                continue;
            }
            $bot['x'] = $bot['anchor'] + sin($this->time * 1.6 + $bot['phase']) * 9.0;
            if (abs($bot['x'] - $this->px) < 18.0 && abs(131.0 - $this->py) < 17.0) {
                if ($this->dashTime > 0.0 || $this->vy > 80.0 && $oldBottom < 125.0) {
                    $bot['alive'] = false;
                    $this->vy = -152.0;
                    $this->score += 400;
                } else {
                    $this->damage();
                }
            }
        }
        unset($bot);
        foreach ([520.0, 1220.0, 1680.0, 2200.0] as $spring) {
            if (abs($this->px - $spring) < 13 && $newBottom >= 130 && $newBottom < 155 && $this->vy >= 0) {
                $this->vy = -330.0;
                $this->grounded = false;
            }
        }
        foreach ([340.0, 1140.0, 1900.0] as $boost) {
            if (abs($this->px - $boost) < 14 && $this->grounded) {
                $this->vx = 260.0;
            }
        }
        if ($this->px > 1000 && $this->checkpoint < 1000) {
            $this->checkpoint = 1010.0;
            $this->score += 250;
            $this->checkpointFx = 1.0;
        }
        $this->checkpointFx = max(0.0, $this->checkpointFx - $dt);
        if ($this->py > 210.0) {
            $this->respawn();
        }
        if ($this->px >= $this->worldWidth - 45) {
            $this->score += max(0, 5000 - (int)round($this->time * 50));
            $this->state = $this->stage === 4 ? 'victory' : 'between';
        }
        $target = max(0.0, min((float)($this->worldWidth - 320), $this->px - 95.0));
        $this->camera += ($target - $this->camera) * min(1.0, $dt * 7.0);
    }

    private function block(Renderer $r, float $x, float $y, float $w, float $h, string $colour): void
    {
        $r->fillRect((int)round($x), (int)round($y), (int)round($w), (int)round($h), $colour);
    }

    public function render(Renderer $r): void
    {
        [$top, $mountain, $horizon, $accent] = self::COLORS[$this->stage];
        $r->clear($top);
        $this->block($r, 0, 60, 320, 120, $mountain);
        $this->block($r, 0, 94, 320, 86, $horizon);
        // parallax silhouette
        for ($i = -1; $i <= 18; $i++) {
            $x = $i * 31 - ((int)($this->camera * 0.2) % 31);
            $h = 18 + ($i * $i * 7 + $this->stage * 13) % 29;
            $this->block($r, $x, 139 - $h, 24, $h, '#202740');
            $this->block($r, $x + 3, 142 - $h, 18, 2, $accent);
            for ($j = 0; $j < 3; $j++) {
                $this->block($r, $x + 5 + $j * 5, 151 - $h, 2, 3, '#a1f2da');
            }
        }
        $moonX = 259 - (int)($this->camera * 0.016);
        $this->block($r, $moonX, 22, 25, 25, '#f2dbb8');
        $this->block($r, $moonX + 7, 19, 25, 25, $top);
        for ($x = max(0, (int)($this->camera / 16) * 16 - 16); $x < min($this->worldWidth, $this->camera + 340); $x += 16) {
            $y = $this->floorAt((float)($x + 8));
            if ($y === null) {
                continue;
            }
            $screenX = $x - $this->camera;
            $this->block($r, $screenX, $y, 16, 180 - $y, '#243c52');
            $this->block($r, $screenX, $y, 16, 3, $accent);
            $this->block($r, $screenX + 3, $y + 11, 10, 2, '#3d6272');
        }
        foreach ($this->platforms as $pl) {
            $x = $pl['x'] - $this->camera;
            if ($x < -90 || $x > 330) {
                continue;
            }
            $this->block($r, $x, $pl['y'], $pl['w'], 7, '#294861');
            $this->block($r, $x + 2, $pl['y'], $pl['w'] - 4, 2, $accent);
        }
        foreach ([520.0, 1220.0, 1680.0, 2200.0] as $spring) {
            $x = $spring - $this->camera;
            $this->block($r, $x - 9, 136, 18, 9, '#fd86b4');
            $this->block($r, $x - 6, 132, 12, 3, '#fff4c4');
        }
        foreach ([340.0, 1140.0, 1900.0] as $boost) {
            $this->block($r, $boost - $this->camera - 12, 140, 24, 5, '#bdeff2');
        }
        foreach ($this->rings as $ring) {
            if (!$ring['on'] || $ring['x'] < $this->camera - 12 || $ring['x'] > $this->camera + 332) {
                continue;
            }
            $x = $ring['x'] - $this->camera;
            $this->block($r, $x - 4, $ring['y'] - 6, 8, 2, '#ffed9c');
            $this->block($r, $x - 6, $ring['y'] - 4, 3, 8, '#ffd063');
            $this->block($r, $x + 3, $ring['y'] - 4, 3, 8, '#ffd063');
            $this->block($r, $x - 4, $ring['y'] + 4, 8, 2, '#ffed9c');
        }
        foreach ($this->bots as $bot) {
            if (!$bot['alive']) {
                continue;
            }
            $x = $bot['x'] - $this->camera;
            $this->block($r, $x - 12, 119, 24, 19, '#ea80ae');
            $this->block($r, $x - 7, 123, 14, 5, '#293454');
            $this->block($r, $x - 5, 124, 2, 2, '#e9ffff');
            $this->block($r, $x + 4, 124, 2, 2, '#e9ffff');
            $this->block($r, $x - 17, 136, 7, 3, '#ffae82');
            $this->block($r, $x + 10, 136, 7, 3, '#ffae82');
        }
        $goalX = $this->worldWidth - 45 - $this->camera;
        if ($goalX > -45 && $goalX < 360) {
            $this->block($r, $goalX - 5, 83, 10, 62, '#426780');
            $this->block($r, $goalX - 17, 82, 34, 6, $accent);
            $this->block($r, $goalX - 10, 73, 20, 12, '#ffda83');
        }
        // the fox: ear silhouette, orange body, cyan glasses, scarf, white boots
        if ($this->invuln <= 0 || ((int)($this->time * 15) % 2) === 0) {
            $x = $this->px - $this->camera;
            $y = $this->py;
            $tail = $this->facing > 0 ? -1 : 1;
            $this->block($r, $x + $tail * 14 - 8, $y + 4, 14, 5, '#e97858');
            $this->block($r, $x - 9, $y - 4, 18, 16, '#e77e58');
            $this->block($r, $x - 10, $y - 16, 19, 14, '#ffac63');
            $this->block($r, $x - 9, $y - 22, 6, 9, '#ffac63');
            $this->block($r, $x + 4, $y - 22, 6, 9, '#ffac63');
            $this->block($r, $x - 8, $y - 11, 16, 6, '#182f4b');
            $this->block($r, $x - 6, $y - 10, 12, 2, '#9dfff4');
            $this->block($r, $x - 7, $y + 10, 8, 3, '#a1e9dc');
            $this->block($r, $x + 3, $y + 10, 9, 3, '#a1e9dc');
            if ($this->dashTime > 0) {
                $this->block($r, $x - $this->facing * 27, $y, 15, 3, '#8afcf1');
            }
        }
        $this->block($r, 0, 0, 320, 15, '#102138');
        $this->font()->draw($r, 'Z' . ($this->stage + 1) . ' ' . self::STAGE_NAMES[$this->stage], 6, 4, 1, '#b8ffe7');
        $this->font()->draw($r, 'O ' . $this->ringsHeld . '  ' . $this->score . '  HP ' . $this->lives, 6, 164, 1, '#fff1be');
        if ($this->checkpointFx > 0) {
            $this->font()->draw($r, 'CHECKPOINT +250', 160, 28, 1, '#82ffe2', 'center');
        }
        if ($this->state !== 'playing') {
            $this->block($r, 19, 45, 282, 87, '#121f36');
            $title = match ($this->state) {
                'menu' => 'NEON FOX TURBO',
                'between' => 'ZONE CLEAR!',
                'victory' => 'HARBOR SAVED!',
                default => 'GAME OVER',
            };
            $this->font()->draw($r, $title, 160, 58, 2, '#7dfcdb', 'center');
            $this->font()->draw($r, '5 ZONES / RINGS / TURBO DASH', 160, 86, 1, '#f9e7ac', 'center');
            $this->font()->draw($r, 'ENTER OR A TO CONTINUE', 160, 105, 1, '#ffffff', 'center');
        }
    }
}
