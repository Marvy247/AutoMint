#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
    Vec,
};

#[derive(Clone, Copy, PartialEq, Eq)]
#[contracttype]
pub enum Tier {
    Basic = 0,
    Advanced = 1,
    Premium = 2,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
#[repr(u32)]
pub enum BotTier {
    Basic = 0,
    Bronze = 1,
    Silver = 2,
    Gold = 3,
    Diamond = 4,
}

impl Tier {
    pub fn price(&self) -> i128 {
        match self {
            Tier::Basic => 0,
            Tier::Advanced => 500_0000000,
            Tier::Premium => 2000_0000000,
        }
    }
}

impl BotTier {
    pub fn price(&self) -> i128 {
        match self {
            BotTier::Basic => 0,
            BotTier::Bronze => 500_0000000,
            BotTier::Silver => 2000_0000000,
            BotTier::Gold => 7500_0000000,
            BotTier::Diamond => 25000_0000000,
        }
    }

    pub fn name(&self, env: &Env) -> String {
        match self {
            BotTier::Basic => String::from_str(env, "Basic Bot"),
            BotTier::Bronze => String::from_str(env, "Bronze Bot"),
            BotTier::Silver => String::from_str(env, "Silver Bot"),
            BotTier::Gold => String::from_str(env, "Gold Bot"),
            BotTier::Diamond => String::from_str(env, "Diamond Bot"),
        }
    }

    pub fn rate(&self) -> u64 {
        match self {
            BotTier::Basic => 1,
            BotTier::Bronze => 5,
            BotTier::Silver => 25,
            BotTier::Gold => 100,
            BotTier::Diamond => 500,
        }
    }
}

#[derive(Clone)]
#[contracttype]
pub struct BotNFT {
    pub id: u64,
    pub tier: BotTier,
    pub owner: Address,
    pub accrual_rate: u64,
    pub minted_at: u64,
    pub name: String,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    NextId,
    Bot(u64),
    UserBots(Address),
    Admin,
    Initialized,
    Registry,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum BotNFTError {
    AlreadyInitialized = 1,
    NotFound = 2,
    Unauthorized = 3,
    InvalidTier = 4,
    BotNotFound = 5,
    NotOwner = 6,
    InsufficientFunds = 7,
    NotInitialized = 8,
}

const LEDGER_BUMP: u32 = 120960;
const LEDGER_THRESHOLD: u32 = 103680;

#[contract]
pub struct BotNFTContract;

#[contractimpl]
impl BotNFTContract {
    pub fn initialize(env: Env, admin: Address, registry: Address) -> Result<(), BotNFTError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(BotNFTError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextId, &1u64);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);
        Ok(())
    }

    pub fn mint_basic(env: Env, owner: Address) -> Result<u64, BotNFTError> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(BotNFTError::NotInitialized);
        }
        owner.require_auth();
        let bot_id = Self::get_next_id(&env);
        let bot_tier = BotTier::Basic;
        let name = bot_tier.name(&env);
        let bot = BotNFT {
            id: bot_id,
            tier: bot_tier,
            owner: owner.clone(),
            accrual_rate: bot_tier.rate(),
            minted_at: env.ledger().timestamp(),
            name,
        };
        env.storage().persistent().set(&DataKey::Bot(bot_id), &bot);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Bot(bot_id), LEDGER_THRESHOLD, LEDGER_BUMP);
        Self::add_bot_to_user(&env, &owner, bot_id);
        Self::increment_bot_count(&env, &owner);
        env.events().publish(
            (symbol_short!("mint"), owner.clone()),
            (bot_id, Tier::Basic),
        );
        Ok(bot_id)
    }

    pub fn mint_tier(env: Env, owner: Address, tier: Tier, token: Address) -> Result<u64, BotNFTError> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(BotNFTError::NotInitialized);
        }
        owner.require_auth();
        
        // Get price and validate token transfer if needed
        let price = tier.price();
        if price > 0 {
            let token_client = token::Client::new(&env, &token);
            // Transfer will fail if owner has insufficient balance
            token_client.transfer(&owner, &env.current_contract_address(), &price);
        }
        
        // Get the next bot ID
        let bot_id = Self::get_next_id(&env);
        let bot_tier = match tier {
            Tier::Basic => BotTier::Basic,
            Tier::Advanced => BotTier::Bronze,
            Tier::Premium => BotTier::Silver,
        };
        // Create and store the bot
        let name = bot_tier.name(&env);
        let bot = BotNFT {
            id: bot_id,
            owner: owner.clone(),
            tier: bot_tier,
            accrual_rate: bot_tier.rate(),
            minted_at: env.ledger().timestamp(),
            name,
        };
        
        env.storage().persistent().set(&DataKey::Bot(bot_id), &bot);
        env.storage().persistent().extend_ttl(
            &DataKey::Bot(bot_id),
            LEDGER_THRESHOLD,
            LEDGER_BUMP,
        );
        
        // Update user's bot list and increment bot count in registry
        Self::add_bot_to_user(&env, &owner, bot_id);
        Self::increment_bot_count(&env, &owner);
        
        // Emit mint event
        env.events().publish(
            (symbol_short!("mint"), owner.clone()),
            (bot_id, tier),
        );
        
        Ok(bot_id)
    }


    pub fn transfer(env: Env, bot_id: u64, from: Address, to: Address) -> Result<(), BotNFTError> {
        from.require_auth();
        if from == to {
            return Ok(());
        }
        let mut bot: BotNFT = env
            .storage()
            .persistent()
            .get(&DataKey::Bot(bot_id))
            .ok_or(BotNFTError::BotNotFound)?;

        if bot.owner != from {
            return Err(BotNFTError::NotOwner);
        }

        bot.owner = to.clone();
        env.storage().persistent().set(&DataKey::Bot(bot_id), &bot);
        Self::remove_bot_from_user(&env, &from, bot_id);
        Self::add_bot_to_user(&env, &to, bot_id);

        env.events()
            .publish((symbol_short!("transfer"), from, to.clone()), bot_id);
        Ok(())
    }

    pub fn get_bot(env: Env, bot_id: u64) -> Result<BotNFT, BotNFTError> {
        env.storage()
            .persistent()
            .get(&DataKey::Bot(bot_id))
            .ok_or(BotNFTError::BotNotFound)
    }

    pub fn get_user_bots(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get::<_, Vec<u64>>(&DataKey::UserBots(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_user_total_rate(env: Env, user: Address) -> u64 {
        let bot_ids = Self::get_user_bots(env.clone(), user);
        let mut total = 0_u64;
        for id in bot_ids.iter() {
            if let Ok(bot) = Self::get_bot(env.clone(), id) {
                total = total.saturating_add(bot.accrual_rate);
            }
        }
        total
    }

    pub fn get_tier_info(env: Env, tier: BotTier) -> (String, u64, i128) {
        (tier.name(&env), tier.rate(), tier.price())
    }

    fn get_next_id(env: &Env) -> u64 {
        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    fn add_bot_to_user(env: &Env, user: &Address, bot_id: u64) {
        let mut bots = env
            .storage()
            .persistent()
            .get::<_, Vec<u64>>(&DataKey::UserBots(user.clone()))
            .unwrap_or_else(|| Vec::new(env));
        bots.push_back(bot_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserBots(user.clone()), &bots);
    }

    fn remove_bot_from_user(env: &Env, user: &Address, bot_id: u64) {
        let bots = env
            .storage()
            .persistent()
            .get::<_, Vec<u64>>(&DataKey::UserBots(user.clone()))
            .unwrap_or_else(|| Vec::new(env));
        let mut new_bots = Vec::new(env);
        for id in bots.iter() {
            if id != bot_id {
                new_bots.push_back(id);
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::UserBots(user.clone()), &new_bots);
    }

    pub fn admin(env: Env) -> Result<Address, BotNFTError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(BotNFTError::NotInitialized)
    }

    fn increment_bot_count(env: &Env, user: &Address) {
        let registry: Address = match env.storage().instance().get(&DataKey::Registry) {
            Some(r) => r,
            None => return,
        };
        let reg_client = automint_registry::RegistryContractClient::new(env, &registry);
        // Use the fallible client so a registry-side error (e.g. the owner is
        // not registered yet) is swallowed rather than panicking the mint.
        let _ = reg_client.try_increment_bot_count(user);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn register_user(env: &Env, registry: &Address, user: &Address, name: &str) {
        let reg_client = automint_registry::RegistryContractClient::new(env, registry);
        let _ = reg_client.register(user, &String::from_str(env, name));
    }

    fn setup() -> (
        Env,
        Address,
        Address,
        Address,
        BotNFTContractClient<'static>,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, BotNFTContract);
        let client = BotNFTContractClient::new(&env, &id);
        let admin = Address::generate(&env);

        let registry_id = env.register_contract(None, automint_registry::RegistryContract);
        let reg_client = automint_registry::RegistryContractClient::new(&env, &registry_id);
        reg_client.initialize(&admin);

        let token_id = env.register_contract(None, automint_token::AMTToken);
        let token_client = automint_token::AMTTokenClient::new(&env, &token_id);
        token_client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "Test Token"),
            &String::from_str(&env, "TST"),
        );

        client.initialize(&admin, &registry_id);
        (env, admin, registry_id, token_id, client)
    }

    fn fund_user(env: &Env, token: &Address, user: &Address, amount: i128) {
        let token_client = automint_token::AMTTokenClient::new(env, token);
        let _ = token_client.mint(user, &amount);
    }

    #[test]
    fn test_mint_basic_assigns_sequential_ids() {
        let (env, _admin, registry, _token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        let id1 = client.mint_basic(&user);
        let id2 = client.mint_basic(&user);
        let id3 = client.mint_basic(&user);
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
        assert_eq!(id3, 3);
    }

    #[test]
    fn test_mint_tier_charges_correct_price() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        fund_user(&env, &token, &user, 100_000_000_000);
        let basic_id = client.mint_tier(&user, &Tier::Basic, &token);
        let advanced_id = client.mint_tier(&user, &Tier::Advanced, &token);
        let premium_id = client.mint_tier(&user, &Tier::Premium, &token);

        let basic_bot = client.get_bot(&basic_id);
        let advanced_bot = client.get_bot(&advanced_id);
        let premium_bot = client.get_bot(&premium_id);

        assert_eq!(basic_bot.accrual_rate, 1);
        assert_eq!(advanced_bot.accrual_rate, 5);
        assert_eq!(premium_bot.accrual_rate, 25);

        assert_eq!(basic_bot.name, String::from_str(&env, "Basic Bot"));
        assert_eq!(advanced_bot.name, String::from_str(&env, "Bronze Bot"));
        assert_eq!(premium_bot.name, String::from_str(&env, "Silver Bot"));

        assert_eq!(basic_bot.tier, BotTier::Basic);
        assert_eq!(advanced_bot.tier, BotTier::Bronze);
        assert_eq!(premium_bot.tier, BotTier::Silver);

        assert_eq!(basic_bot.minted_at, env.ledger().timestamp());
    }

    #[test]
    fn test_transfer_changes_both_owners_bot_lists() {
        let (env, _admin, registry, _token, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        register_user(&env, &registry, &alice, "alice");
        register_user(&env, &registry, &bob, "bob");

        let bot_id = client.mint_basic(&alice);
        assert_eq!(client.get_user_bots(&alice).len(), 1);
        assert_eq!(client.get_user_bots(&bob).len(), 0);

        client.transfer(&bot_id, &alice, &bob);
        assert_eq!(client.get_user_bots(&alice).len(), 0);
        assert_eq!(client.get_user_bots(&bob).len(), 1);
    }

    #[test]
    fn test_transfer_updates_bot_owner() {
        let (env, _admin, registry, _token, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        register_user(&env, &registry, &alice, "alice");

        let bot_id = client.mint_basic(&alice);
        client.transfer(&bot_id, &alice, &bob);

        let bot = client.get_bot(&bot_id);
        assert_eq!(bot.owner, bob);
    }

    #[test]
    fn test_get_user_bots_multiple() {
        let (env, _admin, registry, _token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        let id1 = client.mint_basic(&user);
        let id2 = client.mint_basic(&user);
        let id3 = client.mint_basic(&user);

        let bots = client.get_user_bots(&user);
        assert_eq!(bots.len(), 3);
        assert_eq!(bots.get(0), Some(id1));
        assert_eq!(bots.get(1), Some(id2));
        assert_eq!(bots.get(2), Some(id3));
    }

    #[test]
    fn test_get_user_total_rate_sums_owned_bots() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        fund_user(&env, &token, &user, 100_000_000_000);

        client.mint_basic(&user);
        client.mint_tier(&user, &Tier::Advanced, &token);
        client.mint_tier(&user, &Tier::Premium, &token);

        assert_eq!(client.get_user_total_rate(&user), 31);
    }

    #[test]
    fn test_double_initialize_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        assert_eq!(
            client.try_initialize(&admin, &registry),
            Err(Ok(BotNFTError::AlreadyInitialized))
        );
    }

    #[test]
    fn test_initialize_sets_admin() {
        let (_env, admin, _registry, _token, client) = setup();
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn test_mint_basic_before_init_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, BotNFTContract);
        let client = BotNFTContractClient::new(&env, &id);
        let owner = Address::generate(&env);
        assert_eq!(
            client.try_mint_basic(&owner),
            Err(Ok(BotNFTError::NotInitialized))
        );
    }

    #[test]
    fn test_mint_basic_sets_basic_tier_and_owner() {
        let (env, _admin, registry, _token, client) = setup();
        let owner = Address::generate(&env);
        register_user(&env, &registry, &owner, "owner");
        let bot_id = client.mint_basic(&owner);
        let bot = client.get_bot(&bot_id);
        assert_eq!(bot.owner, owner);
        assert!(bot.tier == BotTier::Basic);
    }

    #[test]
    fn test_mint_basic_increments_registry_count() {
        let (env, _admin, registry, _token, client) = setup();
        let owner = Address::generate(&env);
        register_user(&env, &registry, &owner, "owner");
        let reg_client =
            automint_registry::RegistryContractClient::new(&env, &registry);
        assert_eq!(reg_client.get_user(&owner).bot_count, 0);
        client.mint_basic(&owner);
        client.mint_basic(&owner);
        assert_eq!(reg_client.get_user(&owner).bot_count, 2);
    }

    #[test]
    fn test_mint_basic_unregistered_owner_still_mints() {
        // A registry error (owner not registered) must be swallowed, not
        // panic the mint.
        let (env, _admin, _registry, _token, client) = setup();
        let owner = Address::generate(&env);
        let bot_id = client.mint_basic(&owner);
        assert_eq!(bot_id, 1);
        assert_eq!(client.get_user_bots(&owner).len(), 1);
    }

    #[test]
    fn test_transfer_unauthorized() {
        let (env, _admin, registry, _token, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let charlie = Address::generate(&env);
        register_user(&env, &registry, &alice, "alice");

        let bot_id = client.mint_basic(&alice);
        let result = client.try_transfer(&bot_id, &bob, &charlie);
        assert!(result.is_err());
    }

    #[test]
    fn test_transfer_self_transfer_is_noop() {
        let (env, _admin, registry, _token, client) = setup();
        let alice = Address::generate(&env);
        register_user(&env, &registry, &alice, "alice");

        let bot_id = client.mint_basic(&alice);
        let result = client.try_transfer(&bot_id, &alice, &alice);
        assert!(result.is_ok());
        assert_eq!(client.get_user_bots(&alice).len(), 1);
        let bot = client.get_bot(&bot_id);
        assert_eq!(bot.owner, alice);
    }

    #[test]
    fn test_transfer_nonexistent_bot_fails() {
        let (env, _admin, registry, _token, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        register_user(&env, &registry, &alice, "alice");

        let result = client.try_transfer(&999, &alice, &bob);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_user_total_rate_empty_user() {
        let (env, _admin, registry, _token, client) = setup();
        let user = Address::generate(&env);
        assert_eq!(client.get_user_total_rate(&user), 0);
    }

    #[test]
    fn test_get_user_total_rate_single_bot() {
        let (env, _admin, registry, _token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        client.mint_basic(&user);
        assert_eq!(client.get_user_total_rate(&user), 1);
    }

    #[test]
    fn test_get_user_total_rate_after_transfer() {
        let (env, _admin, registry, _token, client) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        register_user(&env, &registry, &alice, "alice");
        register_user(&env, &registry, &bob, "bob");

        let bot_id = client.mint_basic(&alice);
        assert_eq!(client.get_user_total_rate(&alice), 1);
        assert_eq!(client.get_user_total_rate(&bob), 0);

        client.transfer(&bot_id, &alice, &bob);
        assert_eq!(client.get_user_total_rate(&alice), 0);
        assert_eq!(client.get_user_total_rate(&bob), 1);
    }

    #[test]
    fn test_admin_returns_initialized_admin() {
        let (env, admin, _registry, _token, client) = setup();
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn test_admin_fails_if_not_initialized() {
        let env = Env::default();
        let id = env.register_contract(None, BotNFTContract);
        let client = BotNFTContractClient::new(&env, &id);
        assert!(client.try_admin().is_err());
    }

    #[test]
    fn test_bot_tier_prices() {
        assert_eq!(BotTier::Basic.price(), 0);
        assert_eq!(BotTier::Bronze.price(), 500_0000000);
        assert_eq!(BotTier::Silver.price(), 2000_0000000);
        assert_eq!(BotTier::Gold.price(), 7500_0000000);
        assert_eq!(BotTier::Diamond.price(), 25000_0000000);
    }

    #[test]
    fn test_bot_tier_names() {
        let env = Env::default();
        assert_eq!(
            BotTier::Basic.name(&env),
            String::from_str(&env, "Basic Bot")
        );
        assert_eq!(
            BotTier::Bronze.name(&env),
            String::from_str(&env, "Bronze Bot")
        );
        assert_eq!(
            BotTier::Silver.name(&env),
            String::from_str(&env, "Silver Bot")
        );
        assert_eq!(BotTier::Gold.name(&env), String::from_str(&env, "Gold Bot"));
        assert_eq!(
            BotTier::Diamond.name(&env),
            String::from_str(&env, "Diamond Bot")
        );
    }

    #[test]
    fn test_bot_tier_rates() {
        assert_eq!(BotTier::Basic.rate(), 1);
        assert_eq!(BotTier::Bronze.rate(), 5);
        assert_eq!(BotTier::Silver.rate(), 25);
        assert_eq!(BotTier::Gold.rate(), 100);
        assert_eq!(BotTier::Diamond.rate(), 500);
    }

    #[test]
    fn test_get_tier_info() {
        let (env, _admin, _registry, _token, client) = setup();

        assert_eq!(
            client.get_tier_info(&BotTier::Gold),
            (String::from_str(&env, "Gold Bot"), 100, 7500_0000000)
        );
    }

    #[test]
    fn test_get_bot_returns_correct_bot() {
        let (env, _admin, registry, _token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "botowner");
        let bot_id = client.mint_basic(&user);

        let bot = client.get_bot(&bot_id);
        assert_eq!(bot.id, bot_id);
        assert_eq!(bot.owner, user);
        assert_eq!(bot.accrual_rate, 1);
        assert_eq!(bot.tier, BotTier::Basic);
    }

    #[test]
    fn test_get_bot_nonexistent_id_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        let result = client.try_get_bot(&999);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_bot_zero_id_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        let result = client.try_get_bot(&0);
        assert!(result.is_err());
    }

    #[test]
    fn test_bot_nft_error_variants() {
        assert_eq!(BotNFTError::AlreadyInitialized as u32, 1);
        assert_eq!(BotNFTError::BotNotFound as u32, 5);
        assert_eq!(BotNFTError::NotOwner as u32, 6);
        assert_eq!(BotNFTError::InsufficientFunds as u32, 7);
        assert_eq!(BotNFTError::NotInitialized as u32, 8);
    }

    #[test]
    fn test_mint_tier_basic_is_free() {
        let (env, _admin, registry, token_id, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "testuser");
        
        let token_client = automint_token::AMTTokenClient::new(&env, &token_id);
        let initial_balance = token_client.balance(&user);
        let bot_id = client.mint_tier(&user, &Tier::Basic, &token_id);
        let final_balance = token_client.balance(&user);
        
        // Basic tier should not charge
        assert_eq!(initial_balance, final_balance);
        assert_eq!(bot_id, 1); // First mint in setup uses id 0
    }

    #[test]
    fn test_mint_tier_insufficient_funds() {
        let (env, _admin, registry, token_id, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "testuser");
        
        // User has 0 balance, cannot mint Advanced tier
        let result = client.try_mint_tier(&user, &Tier::Advanced, &token_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_mint_tier_sequential_ids() {
        let (env, _admin, registry, token_id, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "testuser");
        
        let bot1 = client.mint_tier(&user, &Tier::Basic, &token_id);
        let bot2 = client.mint_tier(&user, &Tier::Basic, &token_id);
        let bot3 = client.mint_tier(&user, &Tier::Basic, &token_id);
        
        assert_eq!(bot1, 1); // First mint in setup uses id 0
        assert_eq!(bot2, 2);
        assert_eq!(bot3, 3);
    }

    #[test]
    fn test_mint_tier_updates_user_bot_list() {
        let (env, _admin, registry, token_id, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "testuser");
        
        let bot_id = client.mint_tier(&user, &Tier::Basic, &token_id);
        let user_bots = client.get_user_bots(&user);
        
        assert_eq!(user_bots.len(), 1);
        assert_eq!(user_bots.get(0).unwrap(), bot_id);
    }

    #[test]
    fn test_mint_tier_correct_rate_assignment() {
        let (env, _admin, registry, token_id, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "testuser");
        
        // Mint basic (free)
        let bot_basic = client.mint_tier(&user, &Tier::Basic, &token_id);
        
        // Fund user and mint advanced
        fund_user(&env, &token_id, &user, 500_0000000);
        let bot_advanced = client.mint_tier(&user, &Tier::Advanced, &token_id);
        
        // Fund user more and mint premium
        fund_user(&env, &token_id, &user, 2000_0000000);
        let bot_premium = client.mint_tier(&user, &Tier::Premium, &token_id);
        
        let basic_nft = client.get_bot(&bot_basic);
        let advanced_nft = client.get_bot(&bot_advanced);
        let premium_nft = client.get_bot(&bot_premium);
        
        assert_eq!(basic_nft.accrual_rate, 1);
        assert_eq!(advanced_nft.accrual_rate, 5);
        assert_eq!(premium_nft.accrual_rate, 25);
    }

    #[test]
    fn test_get_tier_info_all_tiers() {
        let (env, _admin, _registry, _token, client) = setup();

        let basic = client.get_tier_info(&BotTier::Basic);
        assert_eq!(basic.0, String::from_str(&env, "Basic Bot"));
        assert_eq!(basic.1, 1);
        assert_eq!(basic.2, 0);

        let bronze = client.get_tier_info(&BotTier::Bronze);
        assert_eq!(bronze.0, String::from_str(&env, "Bronze Bot"));
        assert_eq!(bronze.1, 5);
        assert_eq!(bronze.2, 500_0000000);

        let silver = client.get_tier_info(&BotTier::Silver);
        assert_eq!(silver.0, String::from_str(&env, "Silver Bot"));
        assert_eq!(silver.1, 25);
        assert_eq!(silver.2, 2000_0000000);

        let gold = client.get_tier_info(&BotTier::Gold);
        assert_eq!(gold.0, String::from_str(&env, "Gold Bot"));
        assert_eq!(gold.1, 100);
        assert_eq!(gold.2, 7500_0000000);

        let diamond = client.get_tier_info(&BotTier::Diamond);
        assert_eq!(diamond.0, String::from_str(&env, "Diamond Bot"));
        assert_eq!(diamond.1, 500);
        assert_eq!(diamond.2, 25000_0000000);
    }
}

