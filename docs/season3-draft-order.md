# Season 3 draft order

Season 2's 69 recorded Cup games, attributed through archived team ownership,
produce the fixed order Terry (10 wins), Boz (16), Cooper (19), Ryan (24).
Terry's archived titleDefenses counter is 11; the game-record tally is 10.
This existing discrepancy does not change the order, and no archive data was
modified. Ryan is the Season 2 champion and drafts fourth.

The Season 3 catalog row stores draftOrderNames as
["Terry", "Boz", "Cooper", "Ryan"]. The backend resolves names against the current
season roster because Test and production have different player IDs. It exposes
pickOrderLocked and configuredPickOrder, rejects attempts to change the order or
skip the current picker, starts Terry first, and restores the order on reset.
The same order repeats every round; the draft format is otherwise unchanged.

An already-started practice draft retains its existing picks and order until
reset. draftOrderPendingReset makes this exception visible in Admin. New drafts
use the configured order. Season catalog updates must increment revision and
preserve other catalog attributes to retain transactional write protections.
