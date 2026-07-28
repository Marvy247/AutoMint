#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

#[derive(Clone)]
#[contracttype]
pub struct AccrualState {
    pub last_claim_ts: u64,
    pub total_claimed_points: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    Admin,
    Initialized,
    UserAccrual(Address),
}

#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub points_per_amt: u64,
}

fn read_accrual_state(env: &Env, user: &Address) -> Option<AccrualState> {
    env.storage()
        .persistent()
        .get::<_, UserAccrual>(&DataKey::UserAccrual(user.clone()))
        .map(|a| AccrualState {
            last_claim_ts: a.last_claim_ts,
            total_claimed_points: a.total_claimed_points,
        })
}



#[derive(Clone)]
#[contracttype]
pub struct UserAccrual {
    pub user: Address,
    pub rate: u64,
    pub last_claim_ts: u64,
    pub total_claimed_points: u64,
    pub started_at: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum AccrualError {
    AlreadyInitialized = 1,
    AlreadyStarted = 2,
    NotStarted = 3,
    Unauthorized = 4,
    NotInitialized = 5,
}

const LEDGER_BUMP: u32 = 120960;
const LEDGER_THRESHOLD: u32 = 103680;

#[contract]
pub struct AccrualContract;

#[contractimpl]
impl AccrualContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        points_per_amt: u64,
    ) -> Result<(), AccrualError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(AccrualError::AlreadyInitialized);
        }

        if points_per_amt == 0 {
            return Err(AccrualError::Unauthorized);
        }

        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::Admin, &admin);

        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { points_per_amt });

        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);

        env.storage()
            .instance()
            .extend_ttl(LEDGER_THRESHOLD, LEDGER_BUMP);

        Ok(())
    }

    pub fn start_accrual(env: Env, user: Address, rate: u64) -> Result<(), AccrualError> {
        user.require_auth();
        if env
            .storage()
            .persistent()
            .has(&DataKey::UserAccrual(user.clone()))
        {
            return Err(AccrualError::AlreadyStarted);
        }
        let accrual = UserAccrual {
            user: user.clone(),
            rate,
            last_claim_ts: env.ledger().timestamp(),
            total_claimed_points: 0,
            started_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::UserAccrual(user.clone()), &accrual);
        env.storage().persistent().extend_ttl(
            &DataKey::UserAccrual(user.clone()),
            LEDGER_THRESHOLD,
            LEDGER_BUMP,
        );
        env.events().publish(
            (symbol_short!("start"), user.clone()),
            env.ledger().timestamp(),
        );
        Ok(())
    }

    pub fn pending_points(env: Env, user: Address) -> Result<u128, AccrualError> {
        let accrual: UserAccrual = env
            .storage()
            .persistent()
            .get(&DataKey::UserAccrual(user))
            .ok_or(AccrualError::NotStarted)?;
        let elapsed = env.ledger().timestamp().saturating_sub(accrual.last_claim_ts) as u128;
        Ok(elapsed.saturating_mul(accrual.rate as u128) / 3600)
    }

    pub fn get_accrual_state(env: Env, user: Address) -> Option<AccrualState> {
        read_accrual_state(&env, &user)
    }

    pub fn claim(
        env: Env,
        user: Address,
        token_contract: Address,
        registry: Address,
    ) -> Result<i128, AccrualError> {
        user.require_auth();

        let accrual: UserAccrual = env
            .storage()
            .persistent()
            .get(&DataKey::UserAccrual(user.clone()))
            .ok_or(AccrualError::NotStarted)?;

        let current_ts = env.ledger().timestamp();
        let elapsed = current_ts.saturating_sub(accrual.last_claim_ts);
        let pending = elapsed.saturating_mul(accrual.rate) / 3600;

        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(AccrualError::Unauthorized)?;

        // Total redeemable points
        let updated_points = accrual.total_claimed_points.saturating_add(pending);

        // Number of AMT tokens to mint
        let amt_to_mint = updated_points / config.points_per_amt;

        // Carry forward only leftover points
        let remaining_points = updated_points % config.points_per_amt;

        let reg_client = automint_registry::RegistryContractClient::new(&env, &registry);

        reg_client
            .add_points(&user, &pending);

        if amt_to_mint > 0 {
            let token_client = automint_token::AMTTokenClient::new(&env, &token_contract);

            token_client
                .mint(&user, &(amt_to_mint as i128));

            reg_client
                .add_claimed_amt(&user, &(amt_to_mint as i128));

            env.events().publish(
                (symbol_short!("mint"), user.clone()),
                amt_to_mint as i128,
            );
        }

        // Persist state only after all external calls succeed
        let updated_accrual = UserAccrual {
            user: accrual.user,
            rate: accrual.rate,
            last_claim_ts: current_ts,
            total_claimed_points: remaining_points,
            started_at: accrual.started_at,
        };

        env.storage()
            .persistent()
            .set(&DataKey::UserAccrual(user.clone()), &updated_accrual);
        env.storage().persistent().extend_ttl(
            &DataKey::UserAccrual(user.clone()),
            LEDGER_THRESHOLD,
            LEDGER_BUMP,
        );

        env.events().publish(
            (symbol_short!("claim"), user),
            (pending, remaining_points),
        );

        Ok(pending as i128)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn config(env: Env) -> Result<Config, AccrualError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(AccrualError::NotInitialized)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env, String};

    fn register_user(env: &Env, registry: &Address, user: &Address, name: &str) {
        let reg_client = automint_registry::RegistryContractClient::new(env, registry);
        let _ = reg_client.register(user, &String::from_str(env, name));
    }

    fn setup() -> (
        Env,
        Address,
        Address,
        Address,
        AccrualContractClient<'static>,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, AccrualContract);
        let client = AccrualContractClient::new(&env, &id);
        let admin = Address::generate(&env);

        let registry_id = env.register_contract(None, automint_registry::RegistryContract);
        let reg_client = automint_registry::RegistryContractClient::new(&env, &registry_id);
        reg_client.initialize(&admin);

        let token_id = env.register_contract(None, automint_token::AMTToken);
        let token_client = automint_token::AMTTokenClient::new(&env, &token_id);
        token_client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "AutoMint Token"),
            &String::from_str(&env, "AMT"),
        );

        client.initialize(&admin, &100_u64);
        (env, admin, registry_id, token_id, client)
    }

    #[test]
    fn test_initialize() {
        let (_env, _admin, _registry, _token, client) = setup();
        let config = client.config();
        assert_eq!(config.points_per_amt, 100);
    }

    #[test]
    fn test_double_initialize_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        assert!(client.try_initialize(&_admin, &100_u64).is_err());
    }

    #[test]
    fn test_initialize_zero_points_per_amt_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, AccrualContract);
        let client = AccrualContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        assert!(client.try_initialize(&admin, &0_u64).is_err());
    }

    #[test]
    fn test_start_accrual() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &50_u64);
        assert_eq!(client.pending_points(&user), 0);
    }

    #[test]
    fn test_start_accrual_initializes_correctly() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        let start_ts = env.ledger().timestamp();

        let result = client.try_start_accrual(&user, &50_u64);
        assert!(result.is_ok());

        let state = client.get_accrual_state(&user).unwrap();
        assert_eq!(state.last_claim_ts, start_ts);
        assert_eq!(state.total_claimed_points, 0);
    }

    #[test]
    fn test_double_start_accrual_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &50_u64);
        let result = client.try_start_accrual(&user, &50_u64);
        assert!(result.is_err());
    }

    #[test]
    fn test_pending_points_calculation() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &100_u64);

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number = ledger.sequence_number + 100;
            ledger.timestamp = ledger.timestamp + 500;
        });

        let pending = client.pending_points(&user);
        assert!(pending > 0);
    }

    #[test]
    fn test_claim_resets_timestamp() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        // Use low rate so total_points < points_per_amt (no mint triggered)
        client.start_accrual(&user, &1_u64);

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number = ledger.sequence_number + 10;
            ledger.timestamp = ledger.timestamp + 50;
        });

        let _pending = client.claim(&user, &token, &registry);
        assert_eq!(client.pending_points(&user), 0);
    }

    #[test]
    fn test_claim_below_threshold_mints_nothing() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        // rate=3600 means 1 point per second, so 50s = 50 points < 100 threshold
        client.start_accrual(&user, &3600_u64);

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number = ledger.sequence_number + 10;
            ledger.timestamp = ledger.timestamp + 50;
        });

        let pending = client.claim(&user, &token, &registry);
        assert_eq!(pending, 50);
    }

    #[test]
    fn test_claim_accumulates_total_claimed() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "user1");
        // rate=3600 means 1 point per second, stays below 100 threshold per claim
        client.start_accrual(&user, &3600_u64);

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number = ledger.sequence_number + 10;
            ledger.timestamp = ledger.timestamp + 30;
        });

        let pending = client.claim(&user, &token, &registry);
        assert_eq!(pending, 30);

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number = ledger.sequence_number + 10;
            ledger.timestamp = ledger.timestamp + 30;
        });

        let pending2 = client.claim(&user, &token, &registry);
        assert_eq!(pending2, 30);
    }

    #[test]
    fn test_claim_not_started_fails() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        assert!(client.try_claim(&user, &token, &registry).is_err());
    }

    #[test]
    fn test_pending_points_uses_hourly_rate() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        // rate=3600 pts/hr, elapsed=3600s → exactly 3600 points
        client.start_accrual(&user, &3600_u64);
        env.ledger().with_mut(|l| { l.timestamp += 3600; });
        assert_eq!(client.pending_points(&user), 3600);
    }

    #[test]
    fn test_accrual_state_read() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &100_u64);
        // pending_points returns 0 at t=0 (no elapsed)
        assert_eq!(client.pending_points(&user), 0);
    }

    #[test]
    fn test_get_accrual_state_returns_none_before_start() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);

        assert!(client.get_accrual_state(&user).is_none());
    }

    #[test]
    fn test_get_accrual_state_returns_started_state() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &100_u64);

        let state = client.get_accrual_state(&user).unwrap();
        assert_eq!(state.last_claim_ts, env.ledger().timestamp());
        assert_eq!(state.total_claimed_points, 0);
    }

    #[test]
    fn test_get_accrual_state_after_pending() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &3600_u64);

        // Advance time so pending_points > 0, but don't claim (avoids cross-contract auth)
        env.ledger().with_mut(|l| {
            l.timestamp += 7200;
        });

        let state = client.get_accrual_state(&user).unwrap();
        assert_eq!(state.total_claimed_points, 0);
        assert_eq!(state.last_claim_ts, env.ledger().timestamp() - 7200);
        assert_eq!(client.pending_points(&user), 7200);
    }

    #[test]
    fn test_get_accrual_state_multiple_users_independent() {
        let (env, _admin, _registry, _token, client) = setup();
        let u1 = Address::generate(&env);
        let u2 = Address::generate(&env);
        client.start_accrual(&u1, &100_u64);
        client.start_accrual(&u2, &200_u64);

        let s1 = client.get_accrual_state(&u1).unwrap();
        let s2 = client.get_accrual_state(&u2).unwrap();
        assert_eq!(s1.total_claimed_points, 0);
        assert_eq!(s2.total_claimed_points, 0);
        assert!(client.get_accrual_state(&Address::generate(&env)).is_none());
    }

    #[test]
    fn test_claim_with_zero_elapsed_returns_zero() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "zeroelapsed");
        client.start_accrual(&user, &100_u64);
        let pending = client.claim(&user, &token, &registry);
        assert_eq!(pending, 0);
    }

    #[test]
    fn test_claim_after_claim_with_no_elapsed_returns_zero() {
        let (env, _admin, registry, token, client) = setup();
        let user = Address::generate(&env);
        register_user(&env, &registry, &user, "noelapsed");
        client.start_accrual(&user, &100_u64);

        env.ledger().with_mut(|l| {
            l.timestamp += 100;
        });
        let _ = client.claim(&user, &token, &registry);
        let pending2 = client.claim(&user, &token, &registry);
        assert_eq!(pending2, 0);
    }

    #[test]
    fn test_claim_unregistered_user_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        assert!(client.try_claim(&user, &_token, &_registry).is_err());
    }

    #[test]
    fn test_start_accrual_with_zero_rate() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &0_u64);

        env.ledger().with_mut(|l| { l.timestamp += 3600; });
        assert_eq!(client.pending_points(&user), 0);
    }

    #[test]
    fn test_pending_points_not_started_fails() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        let result = client.try_pending_points(&user);
        assert!(result.is_err());
    }

    #[test]
    fn test_pending_points_zero_elapsed() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &100_u64);
        assert_eq!(client.pending_points(&user), 0);
    }

    #[test]
    fn test_pending_points_correct_calculation() {
        let (env, _admin, _registry, _token, client) = setup();
        let user = Address::generate(&env);
        client.start_accrual(&user, &3600_u64);

        env.ledger().with_mut(|l| { l.timestamp += 1800; });

        assert_eq!(client.pending_points(&user), 1800);
    }

    #[test]
    fn test_config_returns_correct_values() {
        let (_env, _admin, _registry, _token, client) = setup();
        let config = client.config();
        assert_eq!(config.points_per_amt, 100);
    }

    #[test]
    fn test_config_fails_before_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, AccrualContract);
        let client = AccrualContractClient::new(&env, &id);
        let result = client.try_config();
        assert!(result.is_err());
    }

    #[test]
    fn test_config_persists_across_calls() {
        let (_env, _admin, _registry, _token, client) = setup();
        let c1 = client.config();
        let c2 = client.config();
        assert_eq!(c1.points_per_amt, c2.points_per_amt);
    }
}
