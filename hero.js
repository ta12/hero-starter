var move = function(gameData/*Old*/, helpers){
//  var gameData = JSON.parse(JSON.stringify(gameDataOld)); // prevent circular reference error in codetester site
//  gameDataOld.mapBefore = helpers.asciiBoard(gameData);
  var myHero = gameData.activeHero;
  var board = gameData.board;
  var isUnoccupied = function(tile){return tile.type === 'Unoccupied'};
  var isHealthWell = function(tile){return tile.type === 'HealthWell'};
  var isGrave = function(tile){return tile.type === 'Unoccupied' && tile.subType === 'Bones' && !tile.unsafe};
  var isDiamondEnemy = function(tile){
    return tile.type === 'DiamondMine' && ( !(tile.owner) || tile.owner.dead || tile.owner.team!==myHero.team );
  };
  var isDiamondAnyone = function(tile){
    return tile.type === 'DiamondMine' && (!tile.owner || tile.owner.id !== myHero.id);
  };
  var isDiamondAbandoned = function(tile){
    if (!isDiamondAnyone(tile)) return false;
    if (!tile.owner) return true;
    var mineOwner = helpers.findNearestObjectDirectionAndDistance(board, tile, function(enemy){
      return tile.owner.id === enemy.id;
    },false);
    return (!mineOwner || mineOwner.distance > 3);
  };
  var isEnemyBelow = function(hp){return function(tile){
    return tile.type === 'Hero' && tile.team !== myHero.team && tile.health <= hp;
  };};
  var isEnemyAbove = function(hp){return function(tile){
    return tile.type === 'Hero' && tile.team !== myHero.team && tile.health >= hp;
  };};
  var isAllyBelow = function(hp){return function(tile){
    return tile.type === 'Hero' && tile.team === myHero.team && tile.id !== myHero.id && tile.health <= hp;
  };};
  var isProtectedEnemy = function(tile){
    var company = helpers.adjacentTiles(gameData, tile, false).filter(isEnemyAbove(0));
    company = company.filter(isEnemyAbove(0)).concat( company.filter(isHealthWell) );
    return company.length;
  };
  var weakToStrong = function(t1,t2){return t1.health > t2.health};
  var getDirection = function(tile,msg){
    /*
    if(window && window.console){
      console.log(helpers.asciiBoard(gameData));
      console.log(msg+'    myh:'+ (tile==myHero)+'    dir:'+(tile.direction)+'   dW:'+(tile.distanceToWell)+'   dM:'+(tile.distanceToMine));

      for(var i=0; i < possibleMoves.length; ++i){
        var pM=possibleMoves[i];
        console.log('pos:'+pM.distanceFromTop+'|'+pM.distanceFromLeft+'   unsafe:'+pM.unsafe+'   mine:'+pM.distanceToMine+'   well:'+pM.distanceToWell+'   dir:'+pM.direction+'   copyH:'+pM.copyHealth);
      };
    };
    */
    return tile.direction;
  };
  var unsafeMoves=[],safeMoves=[];
  var temp;

  myHero.ringOne = helpers.adjacentTiles(gameData, myHero, true);
  myHero.ringTwo = helpers.ringTwoTiles(gameData, myHero);
  var possibleMoves = myHero.ringOne.filter(isUnoccupied).concat(myHero);
  var nearbyTiles = myHero.ringTwo.concat(myHero.ringOne, myHero);
  for ( var i=0; i < nearbyTiles.length; ++i){
    temp = nearbyTiles[i];
    temp.ringOne = helpers.adjacentTiles(gameData, temp, myHero==temp);
    temp.ringTwo = helpers.ringTwoTiles (gameData, temp);
    temp.alliesNearby = temp.ringOne.filter(isAllyBelow(100)).sort(weakToStrong);
    temp.potionNearby = temp.ringOne.filter(isHealthWell);
    temp.enemiesBelow20 = temp.ringOne.filter(isEnemyBelow(20));
    temp.enemiesAbove20 = temp.ringOne.filter(isEnemyAbove(21)).sort(weakToStrong);
    temp.twoAwayEnemies = temp.ringTwo.filter(isEnemyAbove(0));
    temp.attackedEnemies = temp.twoAwayEnemies.concat(temp.enemiesAbove20);
    if(temp.enemiesAbove20.length && temp.enemiesAbove20[0].health==40){
      temp.enemiesAbove20.push(temp.enemiesAbove20.shift());
    };
  };

  // for all blocks,
  //   list all nearby enemies above 30 health.
  //   if none of them is near an enemy or HealthWell
  for(var i=0; i < possibleMoves.length; ++i){
    var pM = possibleMoves[i];
    for (var j=0; j < gameData.heroes.length; ++j){ // heroes e board nao contem os mesmos objetos
      temp = board.tiles[gameData.heroes[j].distanceFromTop][gameData.heroes[j].distanceFromLeft];
      if ( !gameData.heroes[j].dead /* && gameData.heroes[j].health >= myHero.health ###undefined copyHealth yields NaN on +=,-= ###*/){
        temp.copyHealth = temp.health;
        if (temp.team != myHero.team){
          temp = helpers.adjacentTiles (gameData, temp).concat(helpers.ringTwoTiles(gameData, temp));
          for(var k=0; k < temp.length; ++k){
            if (temp[k].unsafe === undefined) temp[k].unsafe = true;
          }
        };
      }
      //gameData.heroes[j].copyHealth = gameData.heroes[j].health;
    };
    for (var j=0; j < pM.enemiesAbove20.length; ++j){
      temp = pM.enemiesAbove20[j];
      if ( temp.potionNearby.length || temp.enemiesAbove20.length || temp.enemiesBelow20.length )
        break;
    };
    if(j!=pM.enemiesAbove20.length && pM.potionNearby.length==0) {
      pM.unsafe = true;
      unsafeMoves.push(pM);
      pM.copyHealth = -100;
    continue; // enemies are not alone
    };
    pM.copyHealth = myHero.health + 10 * (pM.twoAwayEnemies.length); // 20 dmg from twoAwayEnemies 1st turn
    for (var j=0; j < pM.enemiesAbove20.length; ++j){
      pM.enemiesAbove20[j].copyHealth -= ((j==0 && myHero==pM) ? 30 : 20);
    };
    while (pM.copyHealth > 0 && pM.attackedEnemies.length > 0){
      for(var j= pM.attackedEnemies.length - 1 ;  j >= 0  ; --j){
        if (pM.attackedEnemies[j].copyHealth <= 0) {
          pM.attackedEnemies.splice(j,1);
          pM.copyHealth -= 1; // moves that kill enemies in future take precedence; less copyHealth, more deaths
        };
      };
      pM.copyHealth -= 30 * (pM.attackedEnemies.length);
      for (var j=0; j < pM.attackedEnemies.length; ++j){
        pM.attackedEnemies[j].copyHealth -= 20;
      };
      pM.attackedEnemies.sort(weakToStrong);
      if (pM.attackedEnemies.length && pM.attackedEnemies[0].copyHealth==20)
        pM.attackedEnemies.push(pM.attackedEnemies.shift());
      if (pM.potionNearby.length==0){
        pM.attackedEnemies.length && (pM.attackedEnemies[0].copyHealth -= 10);
      } else {
        pM.copyHealth += 30;
      };
    };
    if (pM.copyHealth <= 0){
      pM.unsafe = true;
      unsafeMoves.push(pM);
    continue;
    } else if (pM.attackedEnemies.length == 0){
      pM.unsafe = false;
      safeMoves.push(pM);
    };
  };

  // fill distanceToMine and distanceToWell, safePath = true
  board.tiles[myHero.distanceFromTop][myHero.distanceFromLeft].type = 'Unoccupied';
  for ( var i=0; i < possibleMoves.length; ++i){
    temp = helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isHealthWell, true);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isHealthWell, false);
    possibleMoves[i].distanceToWell = temp ? temp.distance : 8*board.lengthOfSide;
    temp = helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondAbandoned, true);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondEnemy, true);
    // temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondEnemy, false);
    // Trap, resolves only by replacing myHero from board with new Unoccupied
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondAnyone, true);
    // temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondAnyone, false);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isGrave, true);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondAbandoned, false);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondEnemy, false);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isDiamondAnyone, false);
    temp = temp || helpers.findNearestObjectDirectionAndDistance(board, possibleMoves[i], isEnemyAbove(0), false);
    possibleMoves[i].distanceToMine = temp ? temp.distance : 8*board.lengthOfSide;
  };
  board.tiles[myHero.distanceFromTop][myHero.distanceFromLeft].type = 'Hero';

  //myHero direction write
  if (myHero.alliesNearby.length)
    myHero.direction = myHero.alliesNearby[0].direction;
  if (myHero.enemiesAbove20.length)
    myHero.direction = myHero.enemiesAbove20[0].direction;
  if (myHero.potionNearby.length && myHero.alliesNearby.filter(isAllyBelow(80)).length==0 && myHero.health < 100)
    myHero.direction = myHero.potionNearby[0].direction;;
  if (myHero.potionNearby.length && myHero.health < 80)
    myHero.direction = myHero.potionNearby[0].direction;
  myHero.direction = myHero.direction || 'Stay';
  helpers.adjacentTiles(gameData, myHero, true); // rewrite correct directions to nearby tiles

  // one-hit KO!
  possibleMoves.sort(function(t1,t2){return t1.distanceToMine > t2.distanceToMine;});
  possibleMoves.sort(function(t1,t2){return t1.copyHealth > t2.copyHealth;});
  for (var i=0; i < possibleMoves.length; ++i){
    if (possibleMoves[i].enemiesBelow20.length)
      return getDirection(possibleMoves[i],'FINISH HIM !!');
  };
  if (myHero.enemiesAbove20.length && myHero.enemiesAbove20[0].health==30){
    myHero.direction = myHero.enemiesAbove20[0].direction;
    return getDirection(myHero,'FINISH HIM !!');
  };

  // I'M GONNA DIE! NOOOOOOOOOOOOO'
  unsafeMoves.sort(function(t1,t2){return t1.copyHealth > t2.copyHealth;});
  unsafeMoves.sort(function(t1,t2){return t1.distanceToWell > t2.distanceToWell;})
  if (safeMoves.length == 0){
    if (myHero.distanceToWell === 1) return getDirection(myHero, 'Dont leave the HealthWell');
    for (var i=0; i < unsafeMoves.length; ++i){
      if(unsafeMoves[i].distanceToWell - 1 < myHero.health/20)
        return getDirection(possibleMoves[i],'unsafeMoves health');
    };
    return getDirection(myHero,'NOT safeMoves');
  };

  // ATACAAARRRR
  safeMoves.sort(function(t1,t2){return t1.distanceToWell > t2.distanceToWell;});
  safeMoves.sort(function(t1,t2){return t1.copyHealth > t2.copyHealth;});
  if (!myHero.unsafe && myHero.enemiesAbove20.length)
    return getDirection(myHero,'KEEP PUSHING !!!');
  for (var i=0; i < safeMoves.length; ++i)
    if ( safeMoves[i]!=myHero && safeMoves[i].enemiesAbove20.length)
      return getDirection(safeMoves[i],'ATACAAAAARR ! ! ! ')
  for (var i=0; i < safeMoves.length; ++i){
    if ( safeMoves[i].copyHealth < myHero.health && safeMoves[i].direction !== 'Stay'){
    // check that some tile near that move is Unoccupied and not close to protected enemies
    // do i have a chance if they stay instead of attacking?
      temp = safeMoves[i].ringOne.filter(isUnoccupied);
      for (var j = 0; j < temp.length ; ++j){
        var protectedEnemies = temp[j].ringOne.filter(isProtectedEnemy);
        if (!protectedEnemies.length)
          return getDirection(safeMoves[i],'DEFENDEEEERR ! ! ! ');
      };
    };
  };
/*
  for (var i=0; i < possibleMoves.length; ++i){
    if(possibleMoves[i].enemiesAbove20.length==1
      && possibleMoves[i].twoAwayEnemies.length==0
      && possibleMoves[i].enemiesAbove20[0].potionNearby.length==0
      && possibleMoves[i].enemiesAbove20[0].enemiesAbove20.length==0)      
        return getDirection(possibleMoves[i],'pursuit lone enemy');
  };
*/
  // mine if safe
  var goodHP = 70;
  if (nearbyTiles.filter(isEnemyAbove(myHero.health - 30)).length==0){
    temp = myHero.ringOne.filter(isDiamondEnemy).concat( myHero.ringOne.filter(isDiamondAnyone) );
    if (temp.length && myHero.health > goodHP) return getDirection(temp[0],'take mine');
    if (temp.length && possibleMoves[0].copyHealth > 20 && myHero.distanceToWell <= 3) return getDirection(temp[0],'Dangerous mine ???');
  };
  if (myHero.potionNearby.length && myHero.health <= 90)
    return getDirection(myHero.potionNearby[0],'potionNearby');

  /*
  if (myHero.health <= 40) return getDirection(safeMoves.sort(function(t1,t2){return t1.distanceToWell > t2.distanceToWell;})[0],'health');
  if (myHero.health > 40) return getDirection(safeMoves.sort(function(t1,t2){return t1.distanceToMine > t2.distanceToMine;})[0],'seek mine');
  */
  
  // randomize, and the first two sorts are tie-breaking
  safeMoves.unshift( safeMoves.splice( Math.floor(safeMoves.length * Math.random()) , 1)[0] );
  safeMoves.unshift( safeMoves.splice( Math.floor(safeMoves.length * Math.random()) , 1)[0] );
  safeMoves.sort(function(t1,t2){return t1.distanceToWell > t2.distanceToWell;});
  safeMoves.sort(function(t1,t2){return t1.distanceToMine > t2.distanceToMine;});
  if (myHero.health < 100) safeMoves.sort(function(t1,t2){return t1.distanceToWell > t2.distanceToWell;});
  //  if (myHero.health > goodHP) safeMoves.sort(function(t1,t2){return t1.distanceToMine > t2.distanceToMine;});
//  if (myHero.copyHealth <= 20 || myHero.distanceToWell > 2) safeMoves.sort(function(t1,t2){return t1.distanceToWell > t2.distanceToWell;});
/*
  if (safeMoves.length > 1 && safeMoves[0]==myHero){
    temp = Math.floor(Math.random()*(safeMoves.length));
    return getDirection(safeMoves[temp],'random safeMoves');
  } else if ( (temp=safeMoves.filter(isGrave)) && temp.length > 0 ){
    return getDirection( temp[0],'Grave ROBBER');
  } else {
    return getDirection(safeMoves[0],'safeMoves health or mine');
  };
*/
  if (safeMoves.length == 1) return getDirection(safeMoves[0],'Locked: Nothing else to do');
  if ( (temp=safeMoves.filter(isGrave)) && temp.length > 0 ) return getDirection( temp[0],'Grave ROBBER');
  if (myHero.direction == 'Stay' && safeMoves[0] == myHero){
    if (unsafeMoves.length && unsafeMoves[0].distanceToMine < myHero.distanceToMine)
      return getDirection(unsafeMoves[0],' - - - - BANZAAAII - - - -');
    if (unsafeMoves.length && unsafeMoves[0].distanceToMine < myHero.distanceToMine)
      return getDirection(unsafeMoves[0],' - - - - Run to HealthWell - - - -');
    temp = 1 + Math.floor(Math.random()*(safeMoves.length - 1));
    return getDirection(safeMoves[temp],'random safeMoves, move around');
  } else if (safeMoves[0] == myHero) {
    temp = Math.floor(Math.random()*(safeMoves.length));
    return getDirection(safeMoves[temp],'random safeMoves, hero not JUST staying');
  } else {
    return getDirection(safeMoves[0],'safeMoves health or mine, whatever is closer');
  };
};

module.exports = move;
