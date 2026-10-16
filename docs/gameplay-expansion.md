# Gameplay expansion

Tap PLAY to choose one trait and either an endless walk or a short adventure. The app remembers the choice; RETRY keeps the current run's settings. The flap button can be switched off here. Holding both screen halves still flaps with either setting.

## Skill and pacing

- A successful dodge protects the combo for 1.2 seconds. The approach to a physical obstacle and intentional lean challenges also protect an existing combo, so correct avoidance does not erase it.
- A successful dodge within 280 ms of a changed steering input or flap earns PERFECT and 60 base points. A flap above 75% fall danger also earns PERFECT. Recoveries in tutorial/grace or after a hit do not qualify. Rewards within the same 300 ms recovery are combined.
- Environment events and storm challenges end with three seconds of reduced wind/wobble and nearby recovery coins.
- Star coins require at least 0.3 radians of tilt and cannot be magnetized. Each earns five wallet coins and 100 base points. They remain optional.

## Traits

- Collector: +35% points from coins.
- Acrobat: flap cooldown is 3.5 seconds rather than 5 seconds.
- Family: doubles the existing baby-flamingo score bonus.

## Adventures and companions

- Walk 60 meters within 60 seconds.
- Dodge five hazards within 90 seconds.
- Rescue two babies within 100 seconds.
- Success adds ten coins and 300 points. Timed expiry is distinct from a fall. Completed/expired adventures cannot be continued for repeated rewards.
- A waiting baby joins when reached. Carry it another 22 meters to its nest for five coins and 150 base points. Getting hit or falling loses the passenger. The regular survival-earned babies retain their original behavior.

## Regional hazards

Every third eligible event after the introduction becomes a regional event outside the meadow: a reversing wave force at the beach, ice in the snow zone, or a directional leaf gust in the autumn forest. These use the existing advance-warning system and receive the recovery interval afterward.

## Daily ghost and result feedback

Daily runs store half-second distance samples for the best-distance run on this device. A translucent flamingo shows that run's progress on a later attempt at the same day's course. Old/corrupt or another day's traces are ignored. The trace is bounded to 20 minutes and is a progress ghost, rather than an exact replay of the player's pose or input.

Daily runs use base item durations, no selectable trait, no starter boost and no ad continue so attempts use the same rules. The existing personal-best flag and scores are preserved.

Results show perfects, star coins, rescues, adventure completion/expiry, and a tip selected from the fall circumstances. New feature copy uses English fallback in the bundled locales; existing translated copy is preserved.

## Verification

Run `node_modules/.bin/tsc --noEmit` and `node_modules/.bin/jest --runInBand`. New simulation tests cover skill rewards, protection, traits, gold collection, regional forces, rescue loss/delivery and every adventure outcome. Ghost tests cover interpolation, finish clamping and persisted-trace validation.

## iOS build compatibility

The iOS app uses a `UIWindowSceneDelegate` to create its Expo window, with app lifecycle and link callbacks forwarded to the existing Expo app delegate. This is needed for the iOS 27 SDK; the old application-delegate-only startup successfully builds but is rejected at launch. Scene configuration is recorded in both Info.plist and app.json. CocoaPods also normalizes old resource targets to the existing iOS 15.1 deployment floor.
