/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fcompression.svg)](https://badge.fury.io/js/%40xeokit%2Fcompression)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/kdtree/badge)](https://www.jsdelivr.com/package/npm/@xeokit/kdtree)
 *
 * <img style="padding:30px; height:160px;" src="media://images/kdtree3d.png"/>
 *
 * # xeokit Picking
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqFk8FSwjAQhl8lsydhSqcNFkoOnrgpowOenFxiu2CVJpi2MyLTdzcJlFJETA_J7H7_P7vbZAeJShEYJGtRFNNMrLTIuUwzjUmZKUke5lwStxxBFglK3DUxu9Tru2GLJlTbwwXNo8N2HYy0pGMIh5BDfzAwu-_3OZxK9ySX9mu9n7LkAzU5qUiLrQ3e3KfPGnE49YjS2SqTxDTVY_N9do5FtW6LJiQX-rNCPFMeoj02a9Mdad2tplHaei4Cv30sWrRdnvu20m7l_8gOY2nmeXcc6OVGrOxPyfnITkHlQEs1rXN5HIJLtETnX14YxDX8rPlrKHiQo85Flppr7e4Fh_INc-TAzDHFpTAeHLisDSqqUi22MgFW6go9qDapKPHwEIAtxbowUUyzUunZ4anYzYONkMB28AWMxv6IRtGEBsFwFNGAerAFFgW3fjSOYkrHNA6jOKw9-FbKmAZ-PAnj0YgG45DSOKBj5_bikraM-geREB9Q?type=png)](https://mermaid.live/edit#pako:eNqFk8FSwjAQhl8lsydhSqcNFkoOnrgpowOenFxiu2CVJpi2MyLTdzcJlFJETA_J7H7_P7vbZAeJShEYJGtRFNNMrLTIuUwzjUmZKUke5lwStxxBFglK3DUxu9Tru2GLJlTbwwXNo8N2HYy0pGMIh5BDfzAwu-_3OZxK9ySX9mu9n7LkAzU5qUiLrQ3e3KfPGnE49YjS2SqTxDTVY_N9do5FtW6LJiQX-rNCPFMeoj02a9Mdad2tplHaei4Cv30sWrRdnvu20m7l_8gOY2nmeXcc6OVGrOxPyfnITkHlQEs1rXN5HIJLtETnX14YxDX8rPlrKHiQo85Flppr7e4Fh_INc-TAzDHFpTAeHLisDSqqUi22MgFW6go9qDapKPHwEIAtxbowUUyzUunZ4anYzYONkMB28AWMxv6IRtGEBsFwFNGAerAFFgW3fjSOYkrHNA6jOKw9-FbKmAZ-PAnj0YgG45DSOKBj5_bikraM-geREB9Q)
 *
 * <br>
 *
 * [![](https://mermaid.ink/img/pako:eNqdlstymzAUhl-F0arJEA9Wik1YZJF6JovU00ziVUcbGU4cpUZyJejE9fjdK8RNXEzc4AXm8P2_xLnYHFAkYkAhirZUqQWjG0kTwmMmIUqZ4M7qjnDHHIZwniPgcKhi-ZFog62yI2L9ptV16DjgsMxFlk1bkoB6BdtyAyKBVDI7OGb_w9i1t9n1dChdr0-YLDXsWPJy_X0Hb4vuS8gW7iRLWMr-gBUSiuWpVQuIRLKToNSS6md77y93l0W_4GQi71tUa9VqiW_lAhA3N5mubgQ90-ra5M8haErQ5dWVPk8mlwRZVWuBJnKCLopwju8AWYT6fF6ZCqwT3qPaqal4U1WLtUDC80-T20emhdLOqaT7PPjF2p16iFcS4HrhOkKyDeOOnpuL8Kkgn0Bl29TquITK3xnAiEtJXITLBm3ZHNu7HHLJ9zwI9z1zVFkWHVkjbT_RiKzAH-LvjJdbMYMW8ixZgyyu1vXVsRGsJKN8sz1DZHY1ZPEoGE-H9GWHlyWt6n_btNSJZNsCYQSdhq1zXnQP4SeX6LbE_1gPFtkIBpWEDxR6DO8U9_NoMZrjTDNv53HVAI_Tdv98zBbN-TFXNpQ9Dv2j7nWjqtTDvz_D-qpvP21gzc6IB3JRAjKhLNb_9mZGCEpfIQGCQv01hheq00CQnheN0iwVz3seofCFbhW4KNvFNIXyBaGOQsxSIZflK0R-ctGOchQe0DsKcTCZYd-_wZ53PfOxh120R6HvfZ34cz_AeI6DqR9Mjy76K4Q29SbBzTSYzbA3n2IceHhu3H6am6nM4PgPw96njQ?type=png)](https://mermaid.live/edit#pako:eNqdlstymzAUhl-F0arJEA9Wik1YZJF6JovU00ziVUcbGU4cpUZyJejE9fjdK8RNXEzc4AXm8P2_xLnYHFAkYkAhirZUqQWjG0kTwmMmIUqZ4M7qjnDHHIZwniPgcKhi-ZFog62yI2L9ptV16DjgsMxFlk1bkoB6BdtyAyKBVDI7OGb_w9i1t9n1dChdr0-YLDXsWPJy_X0Hb4vuS8gW7iRLWMr-gBUSiuWpVQuIRLKToNSS6md77y93l0W_4GQi71tUa9VqiW_lAhA3N5mubgQ90-ra5M8haErQ5dWVPk8mlwRZVWuBJnKCLopwju8AWYT6fF6ZCqwT3qPaqal4U1WLtUDC80-T20emhdLOqaT7PPjF2p16iFcS4HrhOkKyDeOOnpuL8Kkgn0Bl29TquITK3xnAiEtJXITLBm3ZHNu7HHLJ9zwI9z1zVFkWHVkjbT_RiKzAH-LvjJdbMYMW8ixZgyyu1vXVsRGsJKN8sz1DZHY1ZPEoGE-H9GWHlyWt6n_btNSJZNsCYQSdhq1zXnQP4SeX6LbE_1gPFtkIBpWEDxR6DO8U9_NoMZrjTDNv53HVAI_Tdv98zBbN-TFXNpQ9Dv2j7nWjqtTDvz_D-qpvP21gzc6IB3JRAjKhLNb_9mZGCEpfIQGCQv01hheq00CQnheN0iwVz3seofCFbhW4KNvFNIXyBaGOQsxSIZflK0R-ctGOchQe0DsKcTCZYd-_wZ53PfOxh120R6HvfZ34cz_AeI6DqR9Mjy76K4Q29SbBzTSYzbA3n2IceHhu3H6am6nM4PgPw96njQ)
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/collision
 * ````
 *
 * ## Dependencies
 *
 * * {@link "@xeokit/scene"}
 * * {@link "@xeokit/core/components"}
 * * {@link "@xeokit/math/math"}
 * * {@link "@xeokit/math/boundaries"}
 *
 * ## Usage
 *
 * ````javascript
 *
 * ````
 *
 * @module @xeokit/collision/pick
 */
export * from "./Picker";
export * from "./MarqueePickResult";
export * from "./RayPickResult";


