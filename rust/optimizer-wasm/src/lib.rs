use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePool {
    #[serde(default)]
    pub ap: i32,
    #[serde(default)]
    pub mp: i32,
    #[serde(default)]
    pub wp: i32,
    #[serde(default)]
    pub bq: i32,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SpellCost {
    #[serde(default)]
    pub ap: i32,
    #[serde(default)]
    pub mp: i32,
    #[serde(default)]
    pub wp: i32,
    #[serde(default)]
    pub bq: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PartialActionContext {
    #[serde(default)]
    pub position: Option<AttackPosition>,
    #[serde(default)]
    pub range_mode: Option<RangeMode>,
    #[serde(default)]
    pub is_critical: Option<bool>,
    #[serde(default)]
    pub is_berserk: Option<bool>,
    #[serde(default)]
    pub is_blocked: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionContext {
    pub position: AttackPosition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range_mode: Option<RangeMode>,
    pub is_critical: bool,
    pub is_berserk: bool,
    pub is_blocked: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AttackPosition {
    Face,
    Side,
    Rear,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RangeMode {
    Melee,
    Distance,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Element {
    Fire,
    Water,
    Earth,
    Air,
    Light,
    Neutral,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Rune {
    Incandescent,
    Aquatic,
    Telluric,
    Aerial,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum HuppermageHeart {
    Fire,
    Water,
    Earth,
    Air,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuneTracker {
    #[serde(default)]
    pub incandescent: bool,
    #[serde(default)]
    pub aquatic: bool,
    #[serde(default)]
    pub telluric: bool,
    #[serde(default)]
    pub aerial: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HuppermageRuneState {
    #[serde(default)]
    pub active: RuneTracker,
    #[serde(default)]
    pub last_generated_rune: Option<Rune>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HuppermageState {
    pub runes: HuppermageRuneState,
    pub rune_ap_gains_this_turn: RuneTracker,
    pub abundance_level: i32,
    pub feu_follets_active: u32,
    pub feu_follet_stored_runes: Vec<Vec<Rune>>,
    pub feu_follet_stored_last_runes: Vec<Option<Rune>>,
    #[serde(default)]
    pub temporary_unlocked_spell_element: Option<Element>,
    pub used_spell_ids: Vec<String>,
    pub active_passives: Vec<String>,
    #[serde(default)]
    pub active_heart: Option<HuppermageHeart>,
    pub bq_max: i32,
    pub stored_bq: i32,
    #[serde(default)]
    pub cooldowns_by_spell_id: BTreeMap<String, u32>,
    pub deck_spell_limit: usize,
    pub passive_limit: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuneGenerationResult {
    pub state: HuppermageState,
    pub resources: ResourcePool,
    pub generated: bool,
    pub granted_ap: bool,
    pub antithese_bq_gain: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AbundanceResult {
    pub state: HuppermageState,
    pub before: i32,
    pub after: i32,
    pub amount: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FeuFolletResult {
    pub state: HuppermageState,
    pub operation: String,
    pub before: u32,
    pub after: u32,
    pub recovered_runes: Vec<Rune>,
    #[serde(default)]
    pub temporary_unlocked_spell_element: Option<Element>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TurnEndBqResult {
    pub state: HuppermageState,
    pub resources: ResourcePool,
    pub amount: i32,
    pub before: i32,
    pub after: i32,
    pub stored_before: i32,
    pub stored_after: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PassiveEffect {
    ResourceDelta {
        resource: String,
        amount: i32,
        #[serde(default)]
        target: Option<String>,
    },
    StatModifier {
        stat: String,
        amount: f64,
        #[serde(default)]
        target: Option<String>,
        #[serde(default)]
        element: Option<Element>,
        #[serde(default)]
        note: Option<String>,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PassiveEntry {
    pub id: String,
    pub effects: Vec<PassiveEffect>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InitialPassiveResult {
    pub stats: BaseStats,
    pub resources: ResourcePool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ActionTargetKind {
    EmptyCell,
    FeuFollet,
    Fighter,
    Ally,
    Enemy,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SpellRules {
    pub id: String,
    #[serde(default)]
    pub element: Option<Element>,
    #[serde(default)]
    pub is_deck_tracked: bool,
    #[serde(default)]
    pub max_casts_per_turn: Option<u32>,
    #[serde(default)]
    pub max_casts_per_target: Option<u32>,
    #[serde(default)]
    pub cooldown_turns: Option<u32>,
    #[serde(default)]
    pub required_target: Option<ActionTargetKind>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SimulationViolation {
    pub violation_type: String,
    pub action_index: u32,
    #[serde(default)]
    pub spell_id: Option<String>,
    #[serde(default)]
    pub required: Option<i32>,
    #[serde(default)]
    pub available: Option<i32>,
    #[serde(default)]
    pub scope: Option<String>,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CarriedTurnState {
    pub resources: ResourcePool,
    pub huppermage: HuppermageState,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ComboProgress {
    pub valid: bool,
    pub completed_turns: u32,
    pub total_damage: f64,
    pub violations: Vec<SimulationViolation>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DamageByElement {
    #[serde(default)]
    pub fire: f64,
    #[serde(default)]
    pub water: f64,
    #[serde(default)]
    pub earth: f64,
    #[serde(default)]
    pub air: f64,
    #[serde(default)]
    pub light: f64,
    #[serde(default)]
    pub neutral: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScoreCriterion {
    TotalDamage,
    TargetElementDamage { element: Element },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SimulationSummary {
    pub valid: bool,
    pub total_damage: f64,
    pub damage_by_resolved_element: DamageByElement,
    pub initial_resources: ResourcePool,
    pub final_resources: ResourcePool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdown {
    pub score: f64,
    pub total_damage: f64,
    #[serde(default)]
    pub target_element: Option<Element>,
    #[serde(default)]
    pub target_element_damage: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SustainabilityResult {
    pub required: bool,
    pub sustainable: bool,
    pub initial_wp: i32,
    pub final_wp: i32,
    pub initial_bq: i32,
    pub final_bq: i32,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElementalMastery {
    #[serde(default)]
    pub fire: f64,
    #[serde(default)]
    pub water: f64,
    #[serde(default)]
    pub earth: f64,
    #[serde(default)]
    pub air: f64,
    #[serde(default)]
    pub light: f64,
    #[serde(default)]
    pub neutral: f64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BaseStats {
    #[serde(default)]
    pub general_mastery: f64,
    #[serde(default)]
    pub elemental_mastery: ElementalMastery,
    #[serde(default)]
    pub melee_mastery: f64,
    #[serde(default)]
    pub distance_mastery: f64,
    #[serde(default)]
    pub berserk_mastery: f64,
    #[serde(default)]
    pub rear_mastery: f64,
    #[serde(default)]
    pub critical_mastery: f64,
    #[serde(default)]
    pub damage_inflicted_percent: f64,
    #[serde(default)]
    pub heals_performed_percent: f64,
    #[serde(default)]
    pub heals_received_percent: f64,
    #[serde(default)]
    pub armor_received_percent: f64,
    #[serde(default)]
    pub elemental_resistance: f64,
    #[serde(default)]
    pub range: f64,
    #[serde(default)]
    pub willpower: f64,
    #[serde(default)]
    pub critical_hit_percent: f64,
    #[serde(default)]
    pub parry: f64,
    #[serde(default)]
    pub damage_received_percent: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DamageEffect {
    pub element: Element,
    pub base: f64,
    #[serde(default)]
    pub times: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DamageFormulaBreakdown {
    pub base_damage: f64,
    pub times: f64,
    pub resolved_element: Element,
    pub elemental_mastery: f64,
    pub extra_mastery: f64,
    pub mastery_multiplier: f64,
    pub critical_multiplier: f64,
    pub position_multiplier: f64,
    pub final_multiplier: f64,
    pub block_multiplier: f64,
    pub result: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResourceViolation {
    pub violation_type: String,
    pub action_index: u32,
    pub spell_id: String,
    pub resource: String,
    pub required: i32,
    pub available: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResourceValidationResult {
    pub valid: bool,
    pub context: ActionContext,
    pub resources_after_cost: ResourcePool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub violation: Option<ResourceViolation>,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizerRequest {
    pub schema_version: u32,
    pub engine: String,
    pub seed: String,
    pub duration: u32,
    pub iterations: u32,
    pub max_actions_per_turn: u32,
    pub max_passive_count: u32,
    #[serde(default)]
    pub available_spell_ids: Vec<String>,
    #[serde(default)]
    pub available_passive_ids: Vec<String>,
    pub catalog: Value,
    pub character: Value,
    #[serde(default)]
    pub criterion: Option<Value>,
    #[serde(default)]
    pub require_sustainable_cycle: bool,
    #[serde(default)]
    pub default_action_context: Option<Value>,
    #[serde(default)]
    pub max_candidates: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizerResponse {
    pub schema_version: u32,
    pub backend: String,
    pub supported: bool,
    pub engine: String,
    pub seed: String,
    pub attempts: u32,
    pub valid_candidates: u32,
    pub invalid_candidates: u32,
    pub metrics: BackendMetrics,
}

#[derive(Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackendMetrics {
    pub request_catalog_entries: u32,
    pub request_available_spells: u32,
    pub request_available_passives: u32,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizerCandidateInput {
    #[serde(default)]
    pub passive_ids: Vec<String>,
    pub plan: CandidatePlan,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CandidatePlan {
    #[serde(default)]
    pub turns: Vec<CandidateTurn>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateTurn {
    #[serde(default)]
    pub actions: Vec<CandidateAction>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateAction {
    pub spell_id: String,
    #[serde(default)]
    pub target: Option<CandidateActionTarget>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateActionTarget {
    pub kind: ActionTargetKind,
}

pub struct SeededRandom {
    state: u32,
}

pub fn parse_optimizer_request(request_json: &str) -> Result<OptimizerRequest, serde_json::Error> {
    serde_json::from_str(request_json)
}

pub fn hash_seed(seed: &str) -> u32 {
    let mut hash = 2_166_136_261_u32;
    for byte in seed.as_bytes() {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(16_777_619);
    }
    hash
}

impl SeededRandom {
    pub fn new(seed: &str) -> Self {
        Self {
            state: hash_seed(seed),
        }
    }

    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut value = self.state;
        value = (value ^ (value >> 15)).wrapping_mul(value | 1);
        value ^= value.wrapping_add((value ^ (value >> 7)).wrapping_mul(value | 61));
        ((value ^ (value >> 14)) as f64) / 4_294_967_296.0
    }

    pub fn integer(&mut self, min: u32, max: u32) -> u32 {
        ((self.next() * ((max - min + 1) as f64)).floor() as u32) + min
    }
}

pub fn normalize_candidate(mut candidate: OptimizerCandidateInput) -> OptimizerCandidateInput {
    candidate.passive_ids.sort();
    candidate
}

pub fn encode_candidate(candidate: &OptimizerCandidateInput) -> String {
    let mut passive_ids = candidate.passive_ids.clone();
    passive_ids.sort();
    format!(
        "{}::{}",
        passive_ids.join("+"),
        candidate
            .plan
            .turns
            .iter()
            .map(encode_candidate_turn)
            .collect::<Vec<_>>()
            .join("|")
    )
}

fn encode_candidate_turn(turn: &CandidateTurn) -> String {
    turn.actions
        .iter()
        .map(encode_candidate_action)
        .collect::<Vec<_>>()
        .join(",")
}

fn encode_candidate_action(action: &CandidateAction) -> String {
    match &action.target {
        Some(target) => format!(
            "{}@{}",
            action.spell_id,
            action_target_kind_key(&target.kind)
        ),
        None => action.spell_id.clone(),
    }
}

fn action_target_kind_key(kind: &ActionTargetKind) -> &'static str {
    match kind {
        ActionTargetKind::EmptyCell => "emptyCell",
        ActionTargetKind::FeuFollet => "feuFollet",
        ActionTargetKind::Fighter => "fighter",
        ActionTargetKind::Ally => "ally",
        ActionTargetKind::Enemy => "enemy",
    }
}

pub fn sample_candidate(
    request: &OptimizerRequest,
    mode: &str,
) -> Result<OptimizerCandidateInput, String> {
    let catalog = read_search_catalog(request)?;
    let actions = get_search_actions(request, &catalog);
    if actions.is_empty() {
        return Err("Cannot sample Rust candidate without available spells.".to_string());
    }

    let mut rng = SeededRandom::new(&request.seed);
    match mode {
        "random" => Ok(create_random_candidate(
            request, &catalog, &actions, &mut rng,
        )),
        "resourceAware" => Ok(create_resource_aware_candidate(
            request, &catalog, &actions, &mut rng,
        )),
        _ => Err(format!(
            "Unknown Rust candidate sampler mode '{mode}'. Expected 'random' or 'resourceAware'."
        )),
    }
}

fn create_random_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    rng: &mut SeededRandom,
) -> OptimizerCandidateInput {
    OptimizerCandidateInput {
        passive_ids: pick_random_passives(request, catalog, rng),
        plan: CandidatePlan {
            turns: (0..request.duration)
                .map(|_| CandidateTurn {
                    actions: (0..rng.integer(1, request.max_actions_per_turn))
                        .map(|_| rng.pick(actions).clone())
                        .collect(),
                })
                .collect(),
        },
    }
}

fn create_resource_aware_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    rng: &mut SeededRandom,
) -> OptimizerCandidateInput {
    let entries_by_id = catalog
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let base_resources = read_request_resources(&request.character);
    let mut resources = base_resources;
    let mut turns = Vec::new();

    for _turn_index in 0..request.duration {
        resources.ap = base_resources.ap;
        resources.mp = base_resources.mp;

        let mut turn_actions = Vec::new();
        let mut casts_by_spell_id: BTreeMap<String, u32> = BTreeMap::new();
        let mut target_casts_by_spell_id: BTreeMap<String, u32> = BTreeMap::new();
        let min_actions = std::cmp::max(
            1,
            ((request.max_actions_per_turn as f64) * 0.55).floor() as u32,
        );
        let target_action_count = rng.integer(min_actions, request.max_actions_per_turn);

        for _action_index in 0..target_action_count {
            let affordable_actions = actions
                .iter()
                .filter(|action| {
                    entries_by_id
                        .get(action.spell_id.as_str())
                        .is_some_and(|spell| {
                            can_use_action_softly(
                                action,
                                spell,
                                resources,
                                &casts_by_spell_id,
                                &target_casts_by_spell_id,
                            )
                        })
                })
                .cloned()
                .collect::<Vec<_>>();

            if affordable_actions.is_empty() {
                break;
            }

            let action = pick_weighted_action(&affordable_actions, &entries_by_id, rng).clone();
            turn_actions.push(action.clone());
            if let Some(spell) = entries_by_id.get(action.spell_id.as_str()) {
                resources = apply_soft_action_resources(resources, spell);
                *casts_by_spell_id.entry(spell.id.clone()).or_insert(0) += 1;
                if counts_as_soft_target_cast(&action) {
                    *target_casts_by_spell_id
                        .entry(spell.id.clone())
                        .or_insert(0) += 1;
                }
            }
        }

        if turn_actions.is_empty() {
            turn_actions.push(rng.pick(actions).clone());
        }

        turns.push(CandidateTurn {
            actions: turn_actions,
        });
    }

    OptimizerCandidateInput {
        passive_ids: pick_random_passives(request, catalog, rng),
        plan: CandidatePlan { turns },
    }
}

impl SeededRandom {
    pub fn pick<'a, T>(&mut self, values: &'a [T]) -> &'a T {
        let index = self.integer(0, (values.len() - 1) as u32) as usize;
        &values[index]
    }

    pub fn chance(&mut self, probability: f64) -> bool {
        self.next() < probability
    }
}

#[derive(Clone, Debug)]
struct SearchCatalogEntry {
    id: String,
    kind: String,
    cost: SpellCost,
    constraints: Vec<Value>,
    effects: Vec<Value>,
    tags: Vec<String>,
}

fn read_search_catalog(request: &OptimizerRequest) -> Result<Vec<SearchCatalogEntry>, String> {
    let entries = request
        .catalog
        .as_array()
        .ok_or_else(|| "Expected optimizer request catalog to be an array.".to_string())?;

    Ok(entries
        .iter()
        .map(|entry| SearchCatalogEntry {
            id: read_string_field(entry, "id").unwrap_or_default(),
            kind: read_string_field(entry, "kind").unwrap_or_default(),
            cost: read_spell_cost(entry.get("cost")),
            constraints: entry
                .get("constraints")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default(),
            effects: entry
                .get("effects")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default(),
            tags: entry
                .get("tags")
                .and_then(Value::as_array)
                .map(|tags| {
                    tags.iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default(),
        })
        .collect())
}

fn read_request_resources(character: &Value) -> ResourcePool {
    read_resource_pool(character.get("resources"))
}

fn read_resource_pool(value: Option<&Value>) -> ResourcePool {
    ResourcePool {
        ap: read_i32_field(value, "ap"),
        mp: read_i32_field(value, "mp"),
        wp: read_i32_field(value, "wp"),
        bq: read_i32_field(value, "bq"),
    }
}

fn read_spell_cost(value: Option<&Value>) -> SpellCost {
    SpellCost {
        ap: read_i32_field(value, "ap"),
        mp: read_i32_field(value, "mp"),
        wp: read_i32_field(value, "wp"),
        bq: read_i32_field(value, "bq"),
    }
}

fn get_search_actions(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
) -> Vec<CandidateAction> {
    let entries_by_id = catalog
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let mut spell_ids = if request.available_spell_ids.is_empty() {
        catalog
            .iter()
            .filter(|entry| entry.kind == "spell")
            .map(|entry| entry.id.clone())
            .collect::<Vec<_>>()
    } else {
        request.available_spell_ids.clone()
    };
    spell_ids.sort();
    spell_ids.dedup();

    let mut actions = Vec::new();
    for spell_id in spell_ids {
        let Some(entry) = entries_by_id.get(spell_id.as_str()) else {
            continue;
        };
        if entry.kind != "spell" {
            continue;
        }

        actions.push(CandidateAction {
            spell_id: spell_id.clone(),
            target: None,
        });

        if entry.constraints.iter().any(|constraint| {
            read_string_field(constraint, "type").is_some_and(|constraint_type| {
                constraint_type == "maxCastsPerTarget"
                    || (constraint_type == "requiresTarget"
                        && read_string_field(constraint, "target")
                            .is_some_and(|target| target == "emptyCell"))
            })
        }) {
            actions.push(CandidateAction {
                spell_id,
                target: Some(CandidateActionTarget {
                    kind: ActionTargetKind::EmptyCell,
                }),
            });
        }
    }

    actions
}

fn pick_random_passives(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    rng: &mut SeededRandom,
) -> Vec<String> {
    let passive_ids = get_available_passive_ids(request, catalog);
    if passive_ids.is_empty() || request.max_passive_count == 0 {
        return Vec::new();
    }

    let passive_limit = std::cmp::min(request.max_passive_count as usize, passive_ids.len());
    let target_count = if rng.chance(0.8) {
        rng.integer(std::cmp::min(1, passive_limit) as u32, passive_limit as u32) as usize
    } else {
        rng.integer(0, passive_limit as u32) as usize
    };
    let mut selected = Vec::new();
    let mut remaining = passive_ids;

    while selected.len() < target_count && !remaining.is_empty() {
        let passive_id = pick_weighted_passive_id(&remaining, request, catalog, rng);
        selected.push(passive_id.clone());
        remaining.retain(|entry| entry != &passive_id);
    }

    selected.sort();
    selected
}

fn get_available_passive_ids(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
) -> Vec<String> {
    let catalog_passive_ids = catalog
        .iter()
        .filter(|entry| entry.kind == "passive")
        .map(|entry| entry.id.as_str())
        .collect::<Vec<_>>();
    let mut passive_ids = request
        .available_passive_ids
        .iter()
        .filter(|passive_id| {
            catalog_passive_ids
                .iter()
                .any(|catalog_id| catalog_id == passive_id)
        })
        .cloned()
        .collect::<Vec<_>>();
    passive_ids.sort();
    passive_ids.dedup();
    passive_ids
}

fn pick_weighted_passive_id(
    passive_ids: &[String],
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    rng: &mut SeededRandom,
) -> String {
    let total_weight = passive_ids
        .iter()
        .map(|passive_id| get_passive_search_weight(passive_id, request, catalog))
        .sum::<f64>();
    let mut cursor = rng.next() * total_weight;

    for passive_id in passive_ids {
        cursor -= get_passive_search_weight(passive_id, request, catalog);
        if cursor <= 0.0 {
            return passive_id.clone();
        }
    }

    passive_ids.last().cloned().unwrap_or_default()
}

fn get_passive_search_weight(
    passive_id: &str,
    _request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
) -> f64 {
    let Some(passive) = catalog
        .iter()
        .find(|entry| entry.id == passive_id && entry.kind == "passive")
    else {
        return 1.0;
    };

    let mut weight = 1.0;
    for effect in &passive.effects {
        if read_string_field(effect, "type").as_deref() == Some("statModifier")
            && read_string_field(effect, "stat").as_deref() == Some("damageInflictedPercent")
        {
            let amount = read_f64_field(Some(effect), "amount");
            if amount > 0.0 {
                weight += amount / 5.0;
            }
        }
    }

    for tag in &passive.tags {
        if ["damage", "abondance", "bq", "heart"].contains(&tag.as_str()) {
            weight += 2.0;
        }
    }

    weight
}

fn can_use_action_softly(
    action: &CandidateAction,
    spell: &SearchCatalogEntry,
    resources: ResourcePool,
    casts_by_spell_id: &BTreeMap<String, u32>,
    target_casts_by_spell_id: &BTreeMap<String, u32>,
) -> bool {
    if !can_afford_cost(resources, spell.cost) {
        return false;
    }

    for constraint in &spell.constraints {
        match read_string_field(constraint, "type").as_deref() {
            Some("requiresTarget") => {
                if action.target.as_ref().map(|target| &target.kind)
                    != read_action_target_kind(constraint.get("target")).as_ref()
                {
                    return false;
                }
            }
            Some("maxCastsPerTurn") => {
                if casts_by_spell_id.get(&spell.id).copied().unwrap_or(0)
                    >= read_u32_field(Some(constraint), "value")
                {
                    return false;
                }
            }
            Some("maxCastsPerTarget") => {
                if counts_as_soft_target_cast(action)
                    && target_casts_by_spell_id
                        .get(&spell.id)
                        .copied()
                        .unwrap_or(0)
                        >= read_u32_field(Some(constraint), "value")
                {
                    return false;
                }
            }
            _ => {}
        }
    }

    true
}

fn can_afford_cost(resources: ResourcePool, cost: SpellCost) -> bool {
    cost.ap.max(0) <= resources.ap
        && cost.mp.max(0) <= resources.mp
        && cost.wp.max(0) <= resources.wp
        && cost.bq.max(0) <= resources.bq
}

fn apply_soft_action_resources(
    mut resources: ResourcePool,
    spell: &SearchCatalogEntry,
) -> ResourcePool {
    resources.ap -= spell.cost.ap.max(0);
    resources.mp -= spell.cost.mp.max(0);
    resources.wp -= spell.cost.wp.max(0);
    resources.bq -= spell.cost.bq.max(0);

    for effect in &spell.effects {
        if read_string_field(effect, "type").as_deref() == Some("resourceDelta")
            && read_string_field(effect, "target")
                .map(|target| target == "caster")
                .unwrap_or(true)
        {
            let amount = read_i32_field(Some(effect), "amount");
            match read_string_field(effect, "resource").as_deref() {
                Some("ap") => resources.ap = (resources.ap + amount).max(0),
                Some("mp") => resources.mp = (resources.mp + amount).max(0),
                Some("wp") => resources.wp = (resources.wp + amount).max(0),
                Some("bq") => resources.bq = (resources.bq + amount).max(0),
                _ => {}
            }
        }
    }

    resources
}

fn pick_weighted_action<'a>(
    actions: &'a [CandidateAction],
    entries_by_id: &BTreeMap<&str, &SearchCatalogEntry>,
    rng: &mut SeededRandom,
) -> &'a CandidateAction {
    let total_weight = actions
        .iter()
        .map(|action| {
            entries_by_id
                .get(action.spell_id.as_str())
                .map(|spell| get_action_search_weight(spell))
                .unwrap_or(1.0)
        })
        .sum::<f64>();
    let mut cursor = rng.next() * total_weight;

    for action in actions {
        cursor -= entries_by_id
            .get(action.spell_id.as_str())
            .map(|spell| get_action_search_weight(spell))
            .unwrap_or(1.0);
        if cursor <= 0.0 {
            return action;
        }
    }

    actions.last().unwrap_or(&actions[0])
}

fn get_action_search_weight(spell: &SearchCatalogEntry) -> f64 {
    let mut weight = 1.0;
    for effect in &spell.effects {
        if read_string_field(effect, "type").as_deref() == Some("damage") {
            weight += (read_f64_field(Some(effect), "base")
                * read_f64_field(Some(effect), "times").max(1.0))
                / 25.0;
        }
        if read_string_field(effect, "type").as_deref() == Some("resourceDelta")
            && read_string_field(effect, "target")
                .map(|target| target == "caster")
                .unwrap_or(true)
            && read_i32_field(Some(effect), "amount") > 0
        {
            weight += 1.0;
        }
    }

    for tag in &spell.tags {
        if ["light", "burst", "rune-consumer", "mark", "scales-with-bq"].contains(&tag.as_str()) {
            weight += 2.0;
        }
    }

    weight.max(1.0)
}

fn counts_as_soft_target_cast(action: &CandidateAction) -> bool {
    action
        .target
        .as_ref()
        .map(|target| target.kind != ActionTargetKind::EmptyCell)
        .unwrap_or(true)
}

fn read_action_target_kind(value: Option<&Value>) -> Option<ActionTargetKind> {
    match value.and_then(Value::as_str) {
        Some("emptyCell") => Some(ActionTargetKind::EmptyCell),
        Some("feuFollet") => Some(ActionTargetKind::FeuFollet),
        Some("fighter") => Some(ActionTargetKind::Fighter),
        Some("ally") => Some(ActionTargetKind::Ally),
        Some("enemy") => Some(ActionTargetKind::Enemy),
        _ => None,
    }
}

fn read_string_field(value: &Value, field: &str) -> Option<String> {
    value.get(field).and_then(Value::as_str).map(str::to_string)
}

fn read_i32_field(value: Option<&Value>, field: &str) -> i32 {
    value
        .and_then(|entry| entry.get(field))
        .and_then(Value::as_i64)
        .unwrap_or(0) as i32
}

fn read_u32_field(value: Option<&Value>, field: &str) -> u32 {
    value
        .and_then(|entry| entry.get(field))
        .and_then(Value::as_u64)
        .unwrap_or(0) as u32
}

fn read_f64_field(value: Option<&Value>, field: &str) -> f64 {
    value
        .and_then(|entry| entry.get(field))
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
}

pub fn resolve_action_context(context: Option<PartialActionContext>) -> ActionContext {
    let context = context.unwrap_or(PartialActionContext {
        position: None,
        range_mode: None,
        is_critical: None,
        is_berserk: None,
        is_blocked: None,
    });

    ActionContext {
        position: context.position.unwrap_or(AttackPosition::Face),
        range_mode: context.range_mode,
        is_critical: context.is_critical.unwrap_or(false),
        is_berserk: context.is_berserk.unwrap_or(false),
        is_blocked: context.is_blocked.unwrap_or(false),
    }
}

pub fn pay_cost(resources: ResourcePool, cost: SpellCost) -> ResourcePool {
    ResourcePool {
        ap: resources.ap - cost.ap,
        mp: resources.mp - cost.mp,
        wp: resources.wp - cost.wp,
        bq: resources.bq - cost.bq,
    }
}

pub fn validate_resource_cost(
    resources: ResourcePool,
    cost: SpellCost,
    spell_id: &str,
    action_index: u32,
    context: Option<PartialActionContext>,
) -> ResourceValidationResult {
    let resolved_context = resolve_action_context(context);

    if let Some((resource, required, available)) = first_insufficient_resource(resources, cost) {
        return ResourceValidationResult {
            valid: false,
            context: resolved_context,
            resources_after_cost: resources,
            violation: Some(ResourceViolation {
                violation_type: "insufficientResource".to_string(),
                action_index,
                spell_id: spell_id.to_string(),
                resource: resource.to_string(),
                required,
                available,
            }),
        };
    }

    ResourceValidationResult {
        valid: true,
        context: resolved_context,
        resources_after_cost: pay_cost(resources, cost),
        violation: None,
    }
}

pub fn compute_raw_damage(
    stats: &BaseStats,
    effect: &DamageEffect,
    context: Option<PartialActionContext>,
) -> DamageFormulaBreakdown {
    let resolved_context = resolve_action_context(context);
    let resolved_element = resolve_damage_element(&effect.element, stats);
    let elemental_mastery = get_elemental_mastery(&stats.elemental_mastery, &resolved_element);
    let extra_mastery = get_extra_mastery(stats, &resolved_context);
    let mastery_multiplier =
        1.0 + (stats.general_mastery + elemental_mastery + extra_mastery) / 100.0;
    let critical_multiplier = if resolved_context.is_critical {
        1.25
    } else {
        1.0
    };
    let position_multiplier = get_position_multiplier(&resolved_context.position);
    let final_multiplier = 1.0 + stats.damage_inflicted_percent / 100.0;
    let block_multiplier = if resolved_context.is_blocked {
        0.8
    } else {
        1.0
    };
    let times = effect.times.unwrap_or(1.0);
    let result = round_damage(
        (effect.base
            * times
            * mastery_multiplier
            * critical_multiplier
            * position_multiplier
            * final_multiplier
            * block_multiplier)
            .max(0.0),
    );

    DamageFormulaBreakdown {
        base_damage: effect.base,
        times,
        resolved_element,
        elemental_mastery,
        extra_mastery,
        mastery_multiplier,
        critical_multiplier,
        position_multiplier,
        final_multiplier,
        block_multiplier,
        result,
    }
}

pub fn resolve_damage_element(element: &Element, stats: &BaseStats) -> Element {
    if *element != Element::Light {
        return element.clone();
    }
    get_highest_elemental_mastery_element(&stats.elemental_mastery)
}

pub fn round_damage(value: f64) -> f64 {
    ((value + f64::EPSILON) * 100.0).round() / 100.0
}

pub fn create_huppermage_state(
    resources: ResourcePool,
    active_passives: Vec<String>,
) -> HuppermageState {
    HuppermageState {
        runes: HuppermageRuneState::default(),
        rune_ap_gains_this_turn: RuneTracker::default(),
        abundance_level: 0,
        feu_follets_active: 0,
        feu_follet_stored_runes: vec![],
        feu_follet_stored_last_runes: vec![],
        temporary_unlocked_spell_element: None,
        used_spell_ids: vec![],
        active_passives,
        active_heart: None,
        bq_max: resources.bq.max(resources.wp * 75),
        stored_bq: 0,
        cooldowns_by_spell_id: BTreeMap::new(),
        deck_spell_limit: 12,
        passive_limit: 6,
    }
}

pub fn convert_wp_to_bq(resources: ResourcePool) -> ResourcePool {
    ResourcePool {
        bq: resources.bq + resources.wp * 75,
        ..resources
    }
}

pub fn apply_generated_rune(
    mut state: HuppermageState,
    mut resources: ResourcePool,
    rune: Rune,
) -> RuneGenerationResult {
    if is_rune_active(&state.runes.active, &rune) {
        return RuneGenerationResult {
            state,
            resources,
            generated: false,
            granted_ap: false,
            antithese_bq_gain: 0,
        };
    }

    let granted_ap = !is_rune_active(&state.rune_ap_gains_this_turn, &rune);
    set_rune_active(&mut state.runes.active, &rune, true);
    set_rune_active(&mut state.rune_ap_gains_this_turn, &rune, true);
    state.runes.last_generated_rune = Some(rune);

    if granted_ap {
        resources.ap += 1;
    }

    let antithese_bq_gain = if has_passive(&state, "antithese") {
        apply_bq_gain_multiplier(20, &state)
    } else {
        0
    };
    resources.bq += antithese_bq_gain;

    RuneGenerationResult {
        state,
        resources,
        generated: true,
        granted_ap,
        antithese_bq_gain,
    }
}

pub fn add_abundance(mut state: HuppermageState, amount: i32) -> AbundanceResult {
    let before = state.abundance_level;
    let limit = if has_passive(&state, "combinaison-elementaire") {
        60
    } else {
        i32::MAX
    };
    let after = (before + amount).clamp(0, limit);
    state.abundance_level = after;

    AbundanceResult {
        state,
        before,
        after,
        amount: after - before,
    }
}

pub fn consume_runes(mut state: HuppermageState, runes: &[Rune]) -> HuppermageState {
    for rune in sort_runes_for_application(runes) {
        set_rune_active(&mut state.runes.active, &rune, false);
    }
    state
}

pub fn apply_coeur_de_lumiere(mut state: HuppermageState) -> Result<HuppermageState, String> {
    let Some(last_generated_rune) = state.runes.last_generated_rune.clone() else {
        return Err("coeur-de-lumiere requires a last generated rune".to_string());
    };
    state.active_heart = Some(rune_to_heart(&last_generated_rune));
    Ok(state)
}

pub fn apply_cycle_elementaire(
    state: HuppermageState,
    resources: ResourcePool,
) -> RuneGenerationResult {
    let Some(last_generated_rune) = state.runes.last_generated_rune.clone() else {
        return RuneGenerationResult {
            state,
            resources,
            generated: false,
            granted_ap: false,
            antithese_bq_gain: 0,
        };
    };

    let was_active = is_rune_active(&state.runes.active, &last_generated_rune);
    let restored_rune = if was_active {
        opposite_rune(&last_generated_rune)
    } else {
        last_generated_rune.clone()
    };
    let mut prepared_state = state;
    if was_active {
        set_rune_active(
            &mut prepared_state.runes.active,
            &last_generated_rune,
            false,
        );
    }
    let mut result = apply_generated_rune(prepared_state, resources, restored_rune);

    if was_active && has_passive(&result.state, "combinaison-elementaire") {
        result.state = add_abundance(result.state, 15).state;
    }

    result
}

pub fn apply_feu_follet_place(mut state: HuppermageState) -> FeuFolletResult {
    let before = state.feu_follets_active;
    let removed_rune = get_feu_follet_stored_rune(&state);
    let stored_runes = get_sauvegarde_runique_stored_runes(&state);
    let stored_last_rune = if stored_runes.is_empty() {
        removed_rune.clone()
    } else {
        None
    };

    state.feu_follets_active += 1;
    state.feu_follet_stored_runes.push(stored_runes);
    state.feu_follet_stored_last_runes.push(stored_last_rune);
    if let Some(rune) = removed_rune {
        set_rune_active(&mut state.runes.active, &rune, false);
    }

    FeuFolletResult {
        state,
        operation: "placed".to_string(),
        before,
        after: before + 1,
        recovered_runes: vec![],
        temporary_unlocked_spell_element: None,
    }
}

pub fn apply_feu_follet_recover(mut state: HuppermageState) -> FeuFolletResult {
    let before = state.feu_follets_active;
    let should_recover_rune = !has_passive(&state, "plenitude");
    let recovered_runes = if state.feu_follet_stored_runes.is_empty() {
        vec![]
    } else {
        state.feu_follet_stored_runes.remove(0)
    };
    let recovered_last_rune = if state.feu_follet_stored_last_runes.is_empty() {
        None
    } else {
        state.feu_follet_stored_last_runes.remove(0)
    };

    if state.feu_follets_active > 0 {
        state.feu_follets_active -= 1;
    }

    if should_recover_rune && !recovered_runes.is_empty() {
        state.runes = apply_recovered_runes(state.runes, &recovered_runes);
    }

    let unlocked_rune = if should_recover_rune && !recovered_runes.is_empty() {
        state.runes.last_generated_rune.clone()
    } else {
        recovered_last_rune.clone()
    };
    state.temporary_unlocked_spell_element = unlocked_rune.as_ref().map(rune_to_element);

    if should_recover_rune {
        if let Some(rune) = recovered_last_rune {
            set_rune_active(&mut state.runes.active, &rune, true);
        }
    } else {
        state = add_abundance(state, 25).state;
    }

    let unlocked_element = state.temporary_unlocked_spell_element.clone();
    let after = state.feu_follets_active;
    FeuFolletResult {
        state,
        operation: "recovered".to_string(),
        before,
        after,
        recovered_runes: sort_runes_for_application(&recovered_runes),
        temporary_unlocked_spell_element: unlocked_element,
    }
}

pub fn apply_turn_end_bq(
    mut state: HuppermageState,
    mut resources: ResourcePool,
) -> TurnEndBqResult {
    let before = resources.bq;
    let stored_before = state.stored_bq;
    let amount = if state.active_heart.is_some() {
        state.stored_bq += 75;
        0
    } else {
        let gain = apply_bq_gain_multiplier(100 + state.stored_bq, &state);
        resources.bq += gain;
        state.stored_bq = 0;
        gain
    };

    let stored_after = state.stored_bq;
    TurnEndBqResult {
        state,
        resources,
        amount,
        before,
        after: resources.bq,
        stored_before,
        stored_after,
    }
}

pub fn apply_initial_passive_effects(
    mut stats: BaseStats,
    mut resources: ResourcePool,
    passives: &[PassiveEntry],
) -> InitialPassiveResult {
    for passive in passives {
        for effect in &passive.effects {
            match effect {
                PassiveEffect::ResourceDelta {
                    resource,
                    amount,
                    target,
                } => {
                    if target.as_deref().is_none() || target.as_deref() == Some("caster") {
                        add_resource_by_name(&mut resources, resource, *amount);
                    }
                }
                PassiveEffect::StatModifier {
                    stat,
                    amount,
                    target,
                    element,
                    note,
                } => {
                    if target.as_deref().is_none() || target.as_deref() == Some("caster") {
                        if should_apply_initial_passive_stat_modifier(
                            &passive.id,
                            stat,
                            note.as_deref(),
                        ) {
                            add_stat_by_name(&mut stats, stat, *amount, element.as_ref());
                        }
                    }
                }
            }
        }
    }

    InitialPassiveResult { stats, resources }
}

pub fn validate_spell_rules(
    spell: &SpellRules,
    action_index: u32,
    target: Option<ActionTargetKind>,
    casts_by_spell_id: &BTreeMap<String, u32>,
    target_casts_by_spell_id: &BTreeMap<String, u32>,
    huppermage_state: &HuppermageState,
) -> Option<SimulationViolation> {
    if let Some(cooldown_remaining) = huppermage_state.cooldowns_by_spell_id.get(&spell.id) {
        if *cooldown_remaining > 0 {
            return Some(SimulationViolation {
                violation_type: "cooldownActive".to_string(),
                action_index,
                spell_id: Some(spell.id.clone()),
                required: spell.cooldown_turns.map(|turns| turns as i32),
                available: Some(*cooldown_remaining as i32),
                scope: None,
                message: format!("Spell '{}' is on cooldown.", spell.id),
            });
        }
    }

    if let Some(required_target) = &spell.required_target {
        if target.as_ref() != Some(required_target) {
            return Some(SimulationViolation {
                violation_type: "invalidTarget".to_string(),
                action_index,
                spell_id: Some(spell.id.clone()),
                required: None,
                available: None,
                scope: None,
                message: format!(
                    "Spell '{}' requires target {:?}.",
                    spell.id, required_target
                ),
            });
        }
    }

    if let Some(max_casts) = spell.max_casts_per_target {
        let current = target_casts_by_spell_id
            .get(&spell.id)
            .copied()
            .unwrap_or(0);
        if current >= max_casts {
            return Some(SimulationViolation {
                violation_type: "castLimitExceeded".to_string(),
                action_index,
                spell_id: Some(spell.id.clone()),
                required: Some(max_casts as i32),
                available: Some(current as i32),
                scope: Some("target".to_string()),
                message: format!("Spell '{}' exceeds max casts per target.", spell.id),
            });
        }
    }

    if let Some(max_casts) = spell.max_casts_per_turn {
        let current = casts_by_spell_id.get(&spell.id).copied().unwrap_or(0);
        if current >= max_casts {
            return Some(SimulationViolation {
                violation_type: "castLimitExceeded".to_string(),
                action_index,
                spell_id: Some(spell.id.clone()),
                required: Some(max_casts as i32),
                available: Some(current as i32),
                scope: Some("turn".to_string()),
                message: format!("Spell '{}' exceeds max casts per turn.", spell.id),
            });
        }
    }

    if !is_spell_available_from_deck(spell, huppermage_state) {
        return Some(SimulationViolation {
            violation_type: "deckLimitExceeded".to_string(),
            action_index,
            spell_id: Some(spell.id.clone()),
            required: Some(huppermage_state.deck_spell_limit as i32),
            available: Some(
                deck_tracked_used_spell_ids(&huppermage_state.used_spell_ids).len() as i32,
            ),
            scope: None,
            message: format!(
                "Spell '{}' is not in the current deck and the deck limit is reached.",
                spell.id
            ),
        });
    }

    None
}

pub fn create_unknown_spell_violation(spell_id: &str, action_index: u32) -> SimulationViolation {
    SimulationViolation {
        violation_type: "unknownSpell".to_string(),
        action_index,
        spell_id: Some(spell_id.to_string()),
        required: None,
        available: None,
        scope: None,
        message: format!("Unknown spell id '{}'.", spell_id),
    }
}

pub fn validate_huppermage_class_action(
    spell_id: &str,
    action_index: u32,
    target: Option<ActionTargetKind>,
    casts_by_spell_id: &BTreeMap<String, u32>,
    huppermage_state: &HuppermageState,
) -> Option<SimulationViolation> {
    if spell_id == "coeur-de-lumiere" && huppermage_state.runes.last_generated_rune.is_none() {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!("Spell '{}' requires a last generated rune.", spell_id),
        });
    }

    if is_runification_spell_id(spell_id) && get_active_rune_count(huppermage_state) <= 0 {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!("Spell '{}' requires at least one active rune.", spell_id),
        });
    }

    if !is_feu_follet_spell_id(spell_id) {
        return None;
    }

    if target == Some(ActionTargetKind::EmptyCell) && get_active_rune_count(huppermage_state) <= 0 {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!(
                "Spell '{}' cannot place a Feu-Follet without an active rune.",
                spell_id
            ),
        });
    }

    if target == Some(ActionTargetKind::EmptyCell)
        && get_feu_follet_stored_rune(huppermage_state).is_none()
    {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!(
                "Spell '{}' cannot place a Feu-Follet because the last generated rune is not active.",
                spell_id
            ),
        });
    }

    if target == Some(ActionTargetKind::EmptyCell)
        && huppermage_state.feu_follets_active >= get_feu_follet_maximum(huppermage_state)
    {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!("Spell '{}' cannot place more active Feu-Follets.", spell_id),
        });
    }

    if target == Some(ActionTargetKind::EmptyCell) {
        if let Some(limit) = get_feu_follet_cast_limit(huppermage_state) {
            let current = casts_by_spell_id.get(spell_id).copied().unwrap_or(0);
            if current >= limit {
                return Some(SimulationViolation {
                    violation_type: "castLimitExceeded".to_string(),
                    action_index,
                    spell_id: Some(spell_id.to_string()),
                    required: Some(limit as i32),
                    available: Some(current as i32),
                    scope: None,
                    message: format!(
                        "Spell '{}' exceeds Feu-Follet max casts per turn ({}).",
                        spell_id, limit
                    ),
                });
            }
        }
    }

    if target == Some(ActionTargetKind::FeuFollet) && huppermage_state.feu_follets_active <= 0 {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!(
                "Spell '{}' cannot recover a Feu-Follet because none is active.",
                spell_id
            ),
        });
    }

    if matches!(
        target,
        Some(ActionTargetKind::Fighter)
            | Some(ActionTargetKind::Ally)
            | Some(ActionTargetKind::Enemy)
    ) {
        return Some(SimulationViolation {
            violation_type: "invalidClassStateAction".to_string(),
            action_index,
            spell_id: Some(spell_id.to_string()),
            required: None,
            available: None,
            scope: None,
            message: format!("Spell '{}' cannot target an entity.", spell_id),
        });
    }

    None
}

pub fn apply_spell_cooldown(cooldowns_by_spell_id: &mut BTreeMap<String, u32>, spell: &SpellRules) {
    if let Some(cooldown) = spell.cooldown_turns {
        cooldowns_by_spell_id.insert(spell.id.clone(), cooldown);
    }
}

pub fn age_cooldowns(
    cooldowns_by_spell_id: &BTreeMap<String, u32>,
    casts_by_spell_id: &BTreeMap<String, u32>,
) -> BTreeMap<String, u32> {
    let mut next = BTreeMap::new();
    for (spell_id, cooldown_remaining) in cooldowns_by_spell_id {
        let next_cooldown = if casts_by_spell_id.contains_key(spell_id) {
            *cooldown_remaining
        } else {
            cooldown_remaining.saturating_sub(1)
        };
        if next_cooldown > 0 {
            next.insert(spell_id.clone(), next_cooldown);
        }
    }
    next
}

pub fn add_used_spell_id(mut state: HuppermageState, spell: &SpellRules) -> HuppermageState {
    if !spell.is_deck_tracked
        || state
            .used_spell_ids
            .iter()
            .any(|spell_id| spell_id == &spell.id)
    {
        return state;
    }

    if deck_tracked_used_spell_ids(&state.used_spell_ids).len() >= state.deck_spell_limit
        && state.temporary_unlocked_spell_element.is_some()
    {
        return state;
    }

    state.used_spell_ids.push(spell.id.clone());
    state
}

pub fn create_next_turn_state(
    base_resources: ResourcePool,
    previous_resources: ResourcePool,
    mut previous_huppermage: HuppermageState,
    casts_by_spell_id: &BTreeMap<String, u32>,
) -> CarriedTurnState {
    previous_huppermage.rune_ap_gains_this_turn = RuneTracker::default();
    previous_huppermage.active_heart = None;
    previous_huppermage.cooldowns_by_spell_id = age_cooldowns(
        &previous_huppermage.cooldowns_by_spell_id,
        casts_by_spell_id,
    );

    CarriedTurnState {
        resources: ResourcePool {
            ap: base_resources.ap,
            mp: base_resources.mp,
            wp: previous_resources.wp,
            bq: previous_resources.bq,
        },
        huppermage: previous_huppermage,
    }
}

pub fn record_combo_turn(
    mut progress: ComboProgress,
    turn_damage: f64,
    violation: Option<SimulationViolation>,
) -> ComboProgress {
    if !progress.valid {
        return progress;
    }

    progress.total_damage = round_damage(progress.total_damage + turn_damage);
    progress.completed_turns += 1;
    if let Some(violation) = violation {
        progress.valid = false;
        progress.violations.push(violation);
    }
    progress
}

pub fn add_resolved_element_damage(
    mut damage_by_element: DamageByElement,
    element: &Element,
    amount: f64,
) -> DamageByElement {
    let rounded_amount = round_damage(amount);
    match element {
        Element::Fire => {
            damage_by_element.fire = round_damage(damage_by_element.fire + rounded_amount)
        }
        Element::Water => {
            damage_by_element.water = round_damage(damage_by_element.water + rounded_amount)
        }
        Element::Earth => {
            damage_by_element.earth = round_damage(damage_by_element.earth + rounded_amount)
        }
        Element::Air => {
            damage_by_element.air = round_damage(damage_by_element.air + rounded_amount)
        }
        Element::Light => {
            damage_by_element.light = round_damage(damage_by_element.light + rounded_amount)
        }
        Element::Neutral => {
            damage_by_element.neutral = round_damage(damage_by_element.neutral + rounded_amount)
        }
    }
    damage_by_element
}

pub fn score_simulation(summary: &SimulationSummary, criterion: &ScoreCriterion) -> ScoreBreakdown {
    match criterion {
        ScoreCriterion::TotalDamage => ScoreBreakdown {
            score: summary.total_damage,
            total_damage: summary.total_damage,
            target_element: None,
            target_element_damage: None,
        },
        ScoreCriterion::TargetElementDamage { element } => {
            let element_damage =
                get_damage_by_element(&summary.damage_by_resolved_element, element);
            ScoreBreakdown {
                score: element_damage,
                total_damage: summary.total_damage,
                target_element: Some(element.clone()),
                target_element_damage: Some(element_damage),
            }
        }
    }
}

pub fn evaluate_sustainability(
    required: bool,
    first: &SimulationSummary,
    replay: &SimulationSummary,
) -> SustainabilityResult {
    let sustainable = replay.valid
        && replay.final_resources.wp >= first.final_resources.wp
        && replay.final_resources.bq >= first.final_resources.bq;

    SustainabilityResult {
        required,
        sustainable: !required || sustainable,
        initial_wp: first.final_resources.wp,
        final_wp: replay.final_resources.wp,
        initial_bq: first.final_resources.bq,
        final_bq: replay.final_resources.bq,
    }
}

fn get_elemental_mastery(mastery: &ElementalMastery, element: &Element) -> f64 {
    match element {
        Element::Fire => mastery.fire,
        Element::Water => mastery.water,
        Element::Earth => mastery.earth,
        Element::Air => mastery.air,
        Element::Light => mastery.light,
        Element::Neutral => mastery.neutral,
    }
}

fn get_damage_by_element(damage_by_element: &DamageByElement, element: &Element) -> f64 {
    match element {
        Element::Fire => damage_by_element.fire,
        Element::Water => damage_by_element.water,
        Element::Earth => damage_by_element.earth,
        Element::Air => damage_by_element.air,
        Element::Light => damage_by_element.light,
        Element::Neutral => damage_by_element.neutral,
    }
}

fn has_passive(state: &HuppermageState, passive_id: &str) -> bool {
    state
        .active_passives
        .iter()
        .any(|passive| passive == passive_id)
}

fn is_runification_spell_id(spell_id: &str) -> bool {
    spell_id == "runification" || spell_id == "runification-test"
}

fn is_feu_follet_spell_id(spell_id: &str) -> bool {
    spell_id == "feu-follet"
}

fn get_feu_follet_maximum(state: &HuppermageState) -> u32 {
    if has_passive(state, "nouveau-souffle") {
        1
    } else {
        2
    }
}

fn get_feu_follet_cast_limit(state: &HuppermageState) -> Option<u32> {
    if has_passive(state, "sauvegarde-runique") {
        Some(1)
    } else {
        None
    }
}

fn is_rune_active(tracker: &RuneTracker, rune: &Rune) -> bool {
    match rune {
        Rune::Incandescent => tracker.incandescent,
        Rune::Aquatic => tracker.aquatic,
        Rune::Telluric => tracker.telluric,
        Rune::Aerial => tracker.aerial,
    }
}

fn set_rune_active(tracker: &mut RuneTracker, rune: &Rune, active: bool) {
    match rune {
        Rune::Incandescent => tracker.incandescent = active,
        Rune::Aquatic => tracker.aquatic = active,
        Rune::Telluric => tracker.telluric = active,
        Rune::Aerial => tracker.aerial = active,
    }
}

fn get_active_rune_count(state: &HuppermageState) -> usize {
    rune_application_order()
        .iter()
        .filter(|rune| is_rune_active(&state.runes.active, rune))
        .count()
}

fn apply_bq_gain_multiplier(amount: i32, state: &HuppermageState) -> i32 {
    let mut multiplier = 1.0;
    if has_passive(state, "transcendance-runique") {
        multiplier *= if get_active_rune_count(state) == rune_application_order().len() {
            2.0
        } else {
            0.5
        };
    }
    if has_passive(state, "profusion-runique") {
        multiplier *= 0.8;
    }
    (amount as f64 * multiplier).round() as i32
}

fn get_sauvegarde_runique_stored_runes(state: &HuppermageState) -> Vec<Rune> {
    if !has_passive(state, "sauvegarde-runique") {
        return vec![];
    }
    let active_runes: Vec<Rune> = rune_application_order()
        .into_iter()
        .filter(|rune| is_rune_active(&state.runes.active, rune))
        .collect();
    if active_runes.len() != 1 {
        return vec![];
    }
    rune_application_order()
        .into_iter()
        .filter(|rune| rune != &active_runes[0])
        .collect()
}

fn get_feu_follet_stored_rune(state: &HuppermageState) -> Option<Rune> {
    let rune = state.runes.last_generated_rune.clone()?;
    if is_rune_active(&state.runes.active, &rune) {
        Some(rune)
    } else {
        None
    }
}

fn apply_recovered_runes(
    mut runes: HuppermageRuneState,
    recovered_runes: &[Rune],
) -> HuppermageRuneState {
    let sorted_runes = sort_runes_for_application(recovered_runes);
    if sorted_runes.is_empty() {
        return runes;
    }

    for rune in &sorted_runes {
        set_rune_active(&mut runes.active, rune, true);
    }
    runes.last_generated_rune = sorted_runes.last().cloned().or(runes.last_generated_rune);
    runes
}

fn sort_runes_for_application(runes: &[Rune]) -> Vec<Rune> {
    rune_application_order()
        .into_iter()
        .filter(|rune| runes.iter().any(|candidate| candidate == rune))
        .collect()
}

fn rune_application_order() -> Vec<Rune> {
    vec![
        Rune::Incandescent,
        Rune::Aquatic,
        Rune::Telluric,
        Rune::Aerial,
    ]
}

fn rune_to_element(rune: &Rune) -> Element {
    match rune {
        Rune::Incandescent => Element::Fire,
        Rune::Aquatic => Element::Water,
        Rune::Telluric => Element::Earth,
        Rune::Aerial => Element::Air,
    }
}

fn rune_to_heart(rune: &Rune) -> HuppermageHeart {
    match rune {
        Rune::Incandescent => HuppermageHeart::Fire,
        Rune::Aquatic => HuppermageHeart::Water,
        Rune::Telluric => HuppermageHeart::Earth,
        Rune::Aerial => HuppermageHeart::Air,
    }
}

fn opposite_rune(rune: &Rune) -> Rune {
    match rune {
        Rune::Incandescent => Rune::Aquatic,
        Rune::Aquatic => Rune::Incandescent,
        Rune::Telluric => Rune::Aerial,
        Rune::Aerial => Rune::Telluric,
    }
}

fn add_resource_by_name(resources: &mut ResourcePool, resource: &str, amount: i32) {
    match resource {
        "ap" => resources.ap += amount,
        "mp" => resources.mp += amount,
        "wp" => resources.wp += amount,
        "bq" => resources.bq += amount,
        _ => {}
    }
}

fn add_stat_by_name(stats: &mut BaseStats, stat: &str, amount: f64, element: Option<&Element>) {
    match stat {
        "generalMastery" => stats.general_mastery += amount,
        "meleeMastery" => stats.melee_mastery += amount,
        "distanceMastery" => stats.distance_mastery += amount,
        "berserkMastery" => stats.berserk_mastery += amount,
        "rearMastery" => stats.rear_mastery += amount,
        "criticalMastery" => stats.critical_mastery += amount,
        "damageInflictedPercent" => stats.damage_inflicted_percent += amount,
        "healsPerformedPercent" => stats.heals_performed_percent += amount,
        "healsReceivedPercent" => stats.heals_received_percent += amount,
        "armorReceivedPercent" => stats.armor_received_percent += amount,
        "elementalResistance" => stats.elemental_resistance += amount,
        "range" => stats.range += amount,
        "willpower" => stats.willpower += amount,
        "criticalHitPercent" => stats.critical_hit_percent += amount,
        "parry" => stats.parry += amount,
        "damageReceivedPercent" => stats.damage_received_percent += amount,
        "elementalMastery" => {
            if let Some(element) = element {
                match element {
                    Element::Fire => stats.elemental_mastery.fire += amount,
                    Element::Water => stats.elemental_mastery.water += amount,
                    Element::Earth => stats.elemental_mastery.earth += amount,
                    Element::Air => stats.elemental_mastery.air += amount,
                    Element::Light => stats.elemental_mastery.light += amount,
                    Element::Neutral => stats.elemental_mastery.neutral += amount,
                }
            }
        }
        _ => {}
    }
}

fn should_apply_initial_passive_stat_modifier(
    passive_id: &str,
    stat: &str,
    note: Option<&str>,
) -> bool {
    if passive_id == "carnage"
        && stat == "damageInflictedPercent"
        && note == Some("Aux cibles ayant de l'Armure.")
    {
        return false;
    }

    if passive_id == "inspiration"
        && stat == "damageInflictedPercent"
        && note == Some("Aux combattants ayant plus d'Initiative.")
    {
        return false;
    }

    true
}

fn is_spell_available_from_deck(spell: &SpellRules, state: &HuppermageState) -> bool {
    if !spell.is_deck_tracked {
        return true;
    }

    state
        .used_spell_ids
        .iter()
        .any(|spell_id| spell_id == &spell.id)
        || deck_tracked_used_spell_ids(&state.used_spell_ids).len() < state.deck_spell_limit
        || (state.temporary_unlocked_spell_element.is_some()
            && spell.element == state.temporary_unlocked_spell_element)
}

fn deck_tracked_used_spell_ids(used_spell_ids: &[String]) -> Vec<String> {
    used_spell_ids
        .iter()
        .filter(|spell_id| {
            spell_id.as_str() != "coeur-de-lumiere"
                && spell_id.as_str() != "cycle-elementaire"
                && spell_id.as_str() != "feu-follet"
        })
        .cloned()
        .collect()
}

fn get_highest_elemental_mastery_element(mastery: &ElementalMastery) -> Element {
    let ordered = [
        (Element::Fire, mastery.fire),
        (Element::Water, mastery.water),
        (Element::Earth, mastery.earth),
        (Element::Air, mastery.air),
    ];

    ordered
        .into_iter()
        .fold((Element::Fire, mastery.fire), |best, current| {
            if current.1 > best.1 {
                current
            } else {
                best
            }
        })
        .0
}

fn get_extra_mastery(stats: &BaseStats, context: &ActionContext) -> f64 {
    let range_mastery = match context.range_mode {
        Some(RangeMode::Melee) => stats.melee_mastery,
        Some(RangeMode::Distance) => stats.distance_mastery,
        None => 0.0,
    };

    range_mastery
        + if context.is_berserk {
            stats.berserk_mastery
        } else {
            0.0
        }
        + if context.position == AttackPosition::Rear {
            stats.rear_mastery
        } else {
            0.0
        }
        + if context.is_critical {
            stats.critical_mastery
        } else {
            0.0
        }
}

fn get_position_multiplier(position: &AttackPosition) -> f64 {
    match position {
        AttackPosition::Rear => 1.25,
        AttackPosition::Side => 1.1,
        AttackPosition::Face => 1.0,
    }
}

fn first_insufficient_resource(
    resources: ResourcePool,
    cost: SpellCost,
) -> Option<(&'static str, i32, i32)> {
    [
        ("ap", cost.ap, resources.ap),
        ("mp", cost.mp, resources.mp),
        ("wp", cost.wp, resources.wp),
        ("bq", cost.bq, resources.bq),
    ]
    .into_iter()
    .find(|(_, required, available)| required > available)
}

#[wasm_bindgen]
pub fn validate_resource_cost_json(
    resources_json: &str,
    cost_json: &str,
    spell_id: &str,
    action_index: u32,
    context_json: Option<String>,
) -> Result<String, JsValue> {
    let resources: ResourcePool = serde_json::from_str(resources_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid resources JSON: {error}")))?;
    let cost: SpellCost = serde_json::from_str(cost_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid cost JSON: {error}")))?;
    let context: Option<PartialActionContext> = match context_json {
        Some(json) => Some(serde_json::from_str(&json).map_err(|error| {
            JsValue::from_str(&format!("Invalid action context JSON: {error}"))
        })?),
        None => None,
    };

    serde_json::to_string(&validate_resource_cost(
        resources,
        cost,
        spell_id,
        action_index,
        context,
    ))
    .map_err(|error| {
        JsValue::from_str(&format!("Failed to serialize resource validation: {error}"))
    })
}

#[wasm_bindgen]
pub fn create_unknown_spell_violation_json(
    spell_id: &str,
    action_index: u32,
) -> Result<String, JsValue> {
    serde_json::to_string(&create_unknown_spell_violation(spell_id, action_index))
        .map_err(|error| JsValue::from_str(&format!("Failed to serialize violation: {error}")))
}

#[wasm_bindgen]
pub fn validate_spell_rules_json(
    spell_json: &str,
    action_index: u32,
    target_json: Option<String>,
    casts_by_spell_id_json: &str,
    target_casts_by_spell_id_json: &str,
    huppermage_state_json: &str,
) -> Result<String, JsValue> {
    let spell: SpellRules = serde_json::from_str(spell_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid spell rules JSON: {error}")))?;
    let target: Option<ActionTargetKind> = match target_json {
        Some(json) => Some(
            serde_json::from_str(&json)
                .map_err(|error| JsValue::from_str(&format!("Invalid target JSON: {error}")))?,
        ),
        None => None,
    };
    let casts_by_spell_id: BTreeMap<String, u32> = serde_json::from_str(casts_by_spell_id_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid casts JSON: {error}")))?;
    let target_casts_by_spell_id: BTreeMap<String, u32> =
        serde_json::from_str(target_casts_by_spell_id_json)
            .map_err(|error| JsValue::from_str(&format!("Invalid target casts JSON: {error}")))?;
    let huppermage_state: HuppermageState = serde_json::from_str(huppermage_state_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid Huppermage state JSON: {error}")))?;

    serde_json::to_string(&validate_spell_rules(
        &spell,
        action_index,
        target,
        &casts_by_spell_id,
        &target_casts_by_spell_id,
        &huppermage_state,
    ))
    .map_err(|error| JsValue::from_str(&format!("Failed to serialize violation: {error}")))
}

#[wasm_bindgen]
pub fn validate_huppermage_class_action_json(
    spell_id: &str,
    action_index: u32,
    target_json: Option<String>,
    casts_by_spell_id_json: &str,
    huppermage_state_json: &str,
) -> Result<String, JsValue> {
    let target: Option<ActionTargetKind> = match target_json {
        Some(json) => Some(
            serde_json::from_str(&json)
                .map_err(|error| JsValue::from_str(&format!("Invalid target JSON: {error}")))?,
        ),
        None => None,
    };
    let casts_by_spell_id: BTreeMap<String, u32> = serde_json::from_str(casts_by_spell_id_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid casts JSON: {error}")))?;
    let huppermage_state: HuppermageState = serde_json::from_str(huppermage_state_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid Huppermage state JSON: {error}")))?;

    serde_json::to_string(&validate_huppermage_class_action(
        spell_id,
        action_index,
        target,
        &casts_by_spell_id,
        &huppermage_state,
    ))
    .map_err(|error| JsValue::from_str(&format!("Failed to serialize violation: {error}")))
}

#[wasm_bindgen]
pub fn compute_raw_damage_json(
    stats_json: &str,
    effect_json: &str,
    context_json: Option<String>,
) -> Result<String, JsValue> {
    let stats: BaseStats = serde_json::from_str(stats_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid stats JSON: {error}")))?;
    let effect: DamageEffect = serde_json::from_str(effect_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid damage effect JSON: {error}")))?;
    let context: Option<PartialActionContext> = match context_json {
        Some(json) => Some(serde_json::from_str(&json).map_err(|error| {
            JsValue::from_str(&format!("Invalid action context JSON: {error}"))
        })?),
        None => None,
    };

    serde_json::to_string(&compute_raw_damage(&stats, &effect, context))
        .map_err(|error| JsValue::from_str(&format!("Failed to serialize damage formula: {error}")))
}

#[wasm_bindgen]
pub fn apply_initial_passive_effects_json(
    stats_json: &str,
    resources_json: &str,
    passives_json: &str,
) -> Result<String, JsValue> {
    let stats: BaseStats = serde_json::from_str(stats_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid stats JSON: {error}")))?;
    let resources: ResourcePool = serde_json::from_str(resources_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid resources JSON: {error}")))?;
    let passives: Vec<PassiveEntry> = serde_json::from_str(passives_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid passives JSON: {error}")))?;

    serde_json::to_string(&apply_initial_passive_effects(stats, resources, &passives)).map_err(
        |error| {
            JsValue::from_str(&format!(
                "Failed to serialize initial passive result: {error}"
            ))
        },
    )
}

#[wasm_bindgen]
pub fn create_next_turn_state_json(
    base_resources_json: &str,
    previous_resources_json: &str,
    previous_huppermage_json: &str,
    casts_by_spell_id_json: &str,
) -> Result<String, JsValue> {
    let base_resources: ResourcePool = serde_json::from_str(base_resources_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid base resources JSON: {error}")))?;
    let previous_resources: ResourcePool = serde_json::from_str(previous_resources_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid previous resources JSON: {error}")))?;
    let previous_huppermage: HuppermageState = serde_json::from_str(previous_huppermage_json)
        .map_err(|error| {
            JsValue::from_str(&format!("Invalid previous Huppermage state JSON: {error}"))
        })?;
    let casts_by_spell_id: BTreeMap<String, u32> = serde_json::from_str(casts_by_spell_id_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid casts JSON: {error}")))?;

    serde_json::to_string(&create_next_turn_state(
        base_resources,
        previous_resources,
        previous_huppermage,
        &casts_by_spell_id,
    ))
    .map_err(|error| JsValue::from_str(&format!("Failed to serialize carried state: {error}")))
}

#[wasm_bindgen]
pub fn apply_feu_follet_recover_json(huppermage_state_json: &str) -> Result<String, JsValue> {
    let huppermage_state: HuppermageState = serde_json::from_str(huppermage_state_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid Huppermage state JSON: {error}")))?;

    serde_json::to_string(&apply_feu_follet_recover(huppermage_state)).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Feu-Follet recovery result: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn apply_turn_end_bq_json(
    huppermage_state_json: &str,
    resources_json: &str,
) -> Result<String, JsValue> {
    let huppermage_state: HuppermageState = serde_json::from_str(huppermage_state_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid Huppermage state JSON: {error}")))?;
    let resources: ResourcePool = serde_json::from_str(resources_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid resources JSON: {error}")))?;

    serde_json::to_string(&apply_turn_end_bq(huppermage_state, resources)).map_err(|error| {
        JsValue::from_str(&format!("Failed to serialize turn-end BQ result: {error}"))
    })
}

#[wasm_bindgen]
pub fn evaluate_sustainability_json(
    required: bool,
    first_summary_json: &str,
    replay_summary_json: &str,
) -> Result<String, JsValue> {
    let first_summary: SimulationSummary = serde_json::from_str(first_summary_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid first summary JSON: {error}")))?;
    let replay_summary: SimulationSummary = serde_json::from_str(replay_summary_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid replay summary JSON: {error}")))?;

    serde_json::to_string(&evaluate_sustainability(
        required,
        &first_summary,
        &replay_summary,
    ))
    .map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize sustainability result: {error}"
        ))
    })
}

pub fn inspect_optimizer_request(request: OptimizerRequest) -> OptimizerResponse {
    OptimizerResponse {
        schema_version: request.schema_version,
        backend: "rustWasm".to_string(),
        supported: request.engine == "hybrid",
        engine: request.engine,
        seed: request.seed,
        attempts: 0,
        valid_candidates: 0,
        invalid_candidates: 0,
        metrics: BackendMetrics {
            request_catalog_entries: request
                .catalog
                .as_array()
                .map(|entries| entries.len() as u32)
                .unwrap_or(0),
            request_available_spells: request.available_spell_ids.len() as u32,
            request_available_passives: request.available_passive_ids.len() as u32,
        },
    }
}

#[wasm_bindgen]
pub fn inspect_optimizer_request_json(request_json: &str) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    serde_json::to_string(&inspect_optimizer_request(request)).map_err(|error| {
        JsValue::from_str(&format!("Failed to serialize optimizer response: {error}"))
    })
}

#[wasm_bindgen]
pub fn encode_candidate_json(candidate_json: &str) -> Result<String, JsValue> {
    let candidate: OptimizerCandidateInput = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate JSON: {error}")))?;
    Ok(encode_candidate(&candidate))
}

#[wasm_bindgen]
pub fn sample_seeded_random_json(seed: &str, count: u32) -> Result<String, JsValue> {
    let mut rng = SeededRandom::new(seed);
    let values = (0..count).map(|_| rng.next()).collect::<Vec<_>>();
    serde_json::to_string(&values).map_err(|error| {
        JsValue::from_str(&format!("Failed to serialize seeded RNG samples: {error}"))
    })
}

#[wasm_bindgen]
pub fn sample_candidate_json(request_json: &str, mode: &str) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let candidate = sample_candidate(&request, mode).map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&candidate).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize sampled Rust candidate: {error}"
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_inspects_optimizer_request() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"same-seed",
              "duration":3,
              "iterations":1000,
              "maxActionsPerTurn":8,
              "maxPassiveCount":3,
              "availableSpellIds":["hit","burst"],
              "availablePassiveIds":["carnage"],
              "catalog":[{"id":"hit"}],
              "character":{"id":"test"},
              "requireSustainableCycle":true
            }"#,
        )
        .expect("request should parse");

        let response = inspect_optimizer_request(request);

        assert!(response.supported);
        assert_eq!(response.backend, "rustWasm");
        assert_eq!(response.metrics.request_catalog_entries, 1);
        assert_eq!(response.metrics.request_available_spells, 2);
        assert_eq!(response.metrics.request_available_passives, 1);
    }

    #[test]
    fn marks_non_hybrid_engines_as_unsupported() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"genetic",
              "seed":"same-seed",
              "duration":2,
              "iterations":10,
              "maxActionsPerTurn":3,
              "maxPassiveCount":0,
              "catalog":[],
              "character":{"id":"test"}
            }"#,
        )
        .expect("request should parse");

        let response = inspect_optimizer_request(request);

        assert!(!response.supported);
        assert_eq!(response.engine, "genetic");
    }

    #[test]
    fn matches_typescript_seeded_rng_sequence() {
        assert_eq!(hash_seed("same-seed"), 3_616_769_443);

        let mut rng = SeededRandom::new("same-seed");
        let values = [rng.next(), rng.next(), rng.next()];

        assert!((values[0] - 0.14761148649267852).abs() < f64::EPSILON);
        assert!((values[1] - 0.957765188999474).abs() < f64::EPSILON);
        assert!((values[2] - 0.8598554644268006).abs() < f64::EPSILON);

        let mut rng = SeededRandom::new("same-seed");
        let integers = (0..5).map(|_| rng.integer(1, 4)).collect::<Vec<_>>();

        assert_eq!(integers, vec![1, 4, 4, 3, 1]);
    }

    #[test]
    fn encodes_candidates_like_typescript_cache_keys() {
        let candidate: OptimizerCandidateInput = serde_json::from_str(
            r#"{
              "passiveIds":["passive-z","passive-a"],
              "plan":{
                "turns":[
                  {
                    "actions":[
                      {"spellId":"ray","target":{"kind":"emptyCell"}},
                      {"spellId":"hit"}
                    ]
                  },
                  {"actions":[]}
                ]
              }
            }"#,
        )
        .expect("candidate should parse");

        assert_eq!(
            encode_candidate(&candidate),
            "passive-a+passive-z::ray@emptyCell,hit|"
        );
        assert_eq!(
            normalize_candidate(candidate).passive_ids,
            vec!["passive-a".to_string(), "passive-z".to_string()]
        );
    }

    #[test]
    fn samples_random_candidates_from_request_actions() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"sampler-random",
              "duration":2,
              "iterations":100,
              "maxActionsPerTurn":3,
              "maxPassiveCount":2,
              "availableSpellIds":["hit","cell"],
              "availablePassiveIds":["passive-a","passive-z"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"cell",
                  "cost":{"ap":1},
                  "effects":[],
                  "constraints":[{"type":"requiresTarget","target":"emptyCell"}],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"hit",
                  "cost":{"ap":2},
                  "effects":[{"type":"damage","base":25,"element":"fire"}],
                  "constraints":[],
                  "tags":["burst"]
                },
                {
                  "kind":"passive",
                  "id":"passive-a",
                  "effects":[{"type":"statModifier","stat":"damageInflictedPercent","amount":10}],
                  "constraints":[],
                  "tags":["damage"]
                },
                {
                  "kind":"passive",
                  "id":"passive-z",
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");

        let first = sample_candidate(&request, "random").expect("random candidate should sample");
        let second =
            sample_candidate(&request, "random").expect("random candidate should be deterministic");

        assert_eq!(first, second);
        assert_eq!(first.plan.turns.len(), 2);
        assert!(first
            .plan
            .turns
            .iter()
            .all(|turn| { !turn.actions.is_empty() && turn.actions.len() <= 3 }));
        assert_eq!(first.passive_ids, {
            let mut ids = first.passive_ids.clone();
            ids.sort();
            ids
        });
    }

    #[test]
    fn samples_resource_aware_candidates_from_affordable_actions() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"sampler-resource-aware",
              "duration":1,
              "iterations":100,
              "maxActionsPerTurn":4,
              "maxPassiveCount":0,
              "availableSpellIds":["cheap","expensive"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"cheap",
                  "cost":{"ap":2},
                  "effects":[{"type":"damage","base":10,"element":"fire"}],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"expensive",
                  "cost":{"ap":10},
                  "effects":[{"type":"damage","base":100,"element":"fire"}],
                  "constraints":[],
                  "tags":["burst"]
                }
              ],
              "character":{"id":"test","resources":{"ap":4,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");

        let candidate = sample_candidate(&request, "resourceAware")
            .expect("resource-aware candidate should sample");
        let actions = &candidate.plan.turns[0].actions;

        assert!(!actions.is_empty());
        assert!(actions.len() <= 2);
        assert!(actions.iter().all(|action| action.spell_id == "cheap"));
    }

    #[test]
    fn validates_and_pays_resource_costs() {
        let result = validate_resource_cost(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            SpellCost {
                ap: 3,
                mp: 1,
                wp: 0,
                bq: 75,
            },
            "burst",
            2,
            Some(PartialActionContext {
                position: Some(AttackPosition::Rear),
                range_mode: Some(RangeMode::Distance),
                is_critical: Some(true),
                is_berserk: None,
                is_blocked: None,
            }),
        );

        assert!(result.valid);
        assert_eq!(
            result.resources_after_cost,
            ResourcePool {
                ap: 9,
                mp: 5,
                wp: 6,
                bq: 425
            }
        );
        assert_eq!(result.context.position, AttackPosition::Rear);
        assert_eq!(result.context.range_mode, Some(RangeMode::Distance));
        assert!(result.context.is_critical);
        assert!(!result.context.is_berserk);
        assert!(!result.context.is_blocked);
    }

    #[test]
    fn rejects_insufficient_resource_without_paying_cost() {
        let result = validate_resource_cost(
            ResourcePool {
                ap: 2,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            SpellCost {
                ap: 3,
                mp: 0,
                wp: 0,
                bq: 0,
            },
            "too-expensive",
            4,
            None,
        );

        assert!(!result.valid);
        assert_eq!(
            result.resources_after_cost,
            ResourcePool {
                ap: 2,
                mp: 6,
                wp: 6,
                bq: 500
            }
        );
        assert_eq!(result.context.position, AttackPosition::Face);
        assert_eq!(
            result.violation,
            Some(ResourceViolation {
                violation_type: "insufficientResource".to_string(),
                action_index: 4,
                spell_id: "too-expensive".to_string(),
                resource: "ap".to_string(),
                required: 3,
                available: 2,
            })
        );
    }

    #[test]
    fn computes_damage_with_contextual_masteries() {
        let formula = compute_raw_damage(
            &BaseStats {
                general_mastery: 100.0,
                elemental_mastery: ElementalMastery {
                    fire: 200.0,
                    ..Default::default()
                },
                distance_mastery: 50.0,
                rear_mastery: 25.0,
                critical_mastery: 75.0,
                damage_inflicted_percent: 10.0,
                ..Default::default()
            },
            &DamageEffect {
                element: Element::Fire,
                base: 20.0,
                times: Some(2.0),
            },
            Some(PartialActionContext {
                position: Some(AttackPosition::Rear),
                range_mode: Some(RangeMode::Distance),
                is_critical: Some(true),
                is_berserk: Some(false),
                is_blocked: Some(false),
            }),
        );

        assert_eq!(formula.resolved_element, Element::Fire);
        assert_eq!(formula.elemental_mastery, 200.0);
        assert_eq!(formula.extra_mastery, 150.0);
        assert_eq!(formula.result, 378.13);
    }

    #[test]
    fn resolves_light_damage_to_highest_elemental_mastery_with_stable_ties() {
        let stats = BaseStats {
            elemental_mastery: ElementalMastery {
                fire: 300.0,
                water: 300.0,
                earth: 100.0,
                air: 50.0,
                ..Default::default()
            },
            ..Default::default()
        };

        assert_eq!(
            resolve_damage_element(&Element::Light, &stats),
            Element::Fire
        );
    }

    #[test]
    fn rounds_damage_to_two_decimals() {
        assert_eq!(round_damage(10.005), 10.01);
        assert_eq!(round_damage(10.004), 10.0);
    }

    #[test]
    fn generates_runes_once_per_turn_and_grants_ap() {
        let state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        let first = apply_generated_rune(
            state,
            ResourcePool {
                ap: 8,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            Rune::Incandescent,
        );

        assert!(first.generated);
        assert!(first.granted_ap);
        assert_eq!(first.resources.ap, 9);
        assert!(first.state.runes.active.incandescent);
        assert_eq!(
            first.state.runes.last_generated_rune,
            Some(Rune::Incandescent)
        );

        let second = apply_generated_rune(first.state, first.resources, Rune::Incandescent);
        assert!(!second.generated);
        assert_eq!(second.resources.ap, 9);
    }

    #[test]
    fn applies_antithese_and_bq_gain_multipliers_on_rune_generation() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec!["antithese".to_string(), "transcendance-runique".to_string()],
        );
        state.runes.active = RuneTracker {
            incandescent: true,
            aquatic: true,
            telluric: true,
            aerial: false,
        };

        let result = apply_generated_rune(
            state,
            ResourcePool {
                ap: 8,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            Rune::Aerial,
        );

        assert_eq!(result.antithese_bq_gain, 40);
        assert_eq!(result.resources.bq, 540);
    }

    #[test]
    fn caps_abundance_with_combinaison_elementaire() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec!["combinaison-elementaire".to_string()],
        );
        state.abundance_level = 50;

        let result = add_abundance(state, 30);

        assert_eq!(result.before, 50);
        assert_eq!(result.after, 60);
        assert_eq!(result.amount, 10);
    }

    #[test]
    fn activates_coeur_de_lumiere_from_last_generated_rune() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        state.runes.last_generated_rune = Some(Rune::Aquatic);

        let state = apply_coeur_de_lumiere(state).expect("heart should activate");

        assert_eq!(state.active_heart, Some(HuppermageHeart::Water));
    }

    #[test]
    fn cycle_elementaire_restores_opposite_active_last_rune() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec!["combinaison-elementaire".to_string()],
        );
        state.runes.last_generated_rune = Some(Rune::Incandescent);
        state.runes.active.incandescent = true;

        let result = apply_cycle_elementaire(
            state,
            ResourcePool {
                ap: 8,
                mp: 6,
                wp: 6,
                bq: 500,
            },
        );

        assert!(result.state.runes.active.aquatic);
        assert!(!result.state.runes.active.incandescent);
        assert_eq!(result.state.runes.last_generated_rune, Some(Rune::Aquatic));
        assert_eq!(result.state.abundance_level, 15);
    }

    #[test]
    fn places_and_recovers_feu_follet_with_sauvegarde_runique_storage() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec!["sauvegarde-runique".to_string()],
        );
        state.runes.active.aerial = true;
        state.runes.last_generated_rune = Some(Rune::Aerial);

        let placed = apply_feu_follet_place(state);
        assert_eq!(placed.before, 0);
        assert_eq!(placed.after, 1);
        assert!(!placed.state.runes.active.aerial);
        assert_eq!(
            placed.state.feu_follet_stored_runes[0],
            vec![Rune::Incandescent, Rune::Aquatic, Rune::Telluric]
        );

        let recovered = apply_feu_follet_recover(placed.state);
        assert_eq!(recovered.before, 1);
        assert_eq!(recovered.after, 0);
        assert_eq!(
            recovered.recovered_runes,
            vec![Rune::Incandescent, Rune::Aquatic, Rune::Telluric]
        );
        assert_eq!(
            recovered.state.runes.last_generated_rune,
            Some(Rune::Telluric)
        );
        assert_eq!(
            recovered.temporary_unlocked_spell_element,
            Some(Element::Earth)
        );
    }

    #[test]
    fn turn_end_stores_bq_under_heart_and_regenerates_without_heart() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        state.active_heart = Some(HuppermageHeart::Fire);

        let stored = apply_turn_end_bq(
            state,
            ResourcePool {
                ap: 0,
                mp: 0,
                wp: 6,
                bq: 300,
            },
        );
        assert_eq!(stored.amount, 0);
        assert_eq!(stored.stored_after, 75);
        assert_eq!(stored.resources.bq, 300);

        let mut next_state = stored.state;
        next_state.active_heart = None;
        let regenerated = apply_turn_end_bq(next_state, stored.resources);
        assert_eq!(regenerated.amount, 175);
        assert_eq!(regenerated.resources.bq, 475);
        assert_eq!(regenerated.stored_after, 0);
    }

    #[test]
    fn converts_wp_to_initial_bq() {
        let converted = convert_wp_to_bq(ResourcePool {
            ap: 12,
            mp: 6,
            wp: 6,
            bq: 100,
        });

        assert_eq!(converted.bq, 550);
        assert_eq!(converted.wp, 6);
    }

    #[test]
    fn applies_initial_passive_resource_and_stat_modifiers() {
        let result = apply_initial_passive_effects(
            BaseStats::default(),
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            &[
                PassiveEntry {
                    id: "resource-passive".to_string(),
                    effects: vec![PassiveEffect::ResourceDelta {
                        resource: "ap".to_string(),
                        amount: 1,
                        target: Some("caster".to_string()),
                    }],
                },
                PassiveEntry {
                    id: "mastery-passive".to_string(),
                    effects: vec![
                        PassiveEffect::StatModifier {
                            stat: "damageInflictedPercent".to_string(),
                            amount: 10.0,
                            target: None,
                            element: None,
                            note: None,
                        },
                        PassiveEffect::StatModifier {
                            stat: "elementalMastery".to_string(),
                            amount: 50.0,
                            target: None,
                            element: Some(Element::Fire),
                            note: None,
                        },
                    ],
                },
            ],
        );

        assert_eq!(result.resources.ap, 13);
        assert_eq!(result.stats.damage_inflicted_percent, 10.0);
        assert_eq!(result.stats.elemental_mastery.fire, 50.0);
        assert_eq!(result.stats.elemental_mastery.water, 0.0);
        assert_eq!(result.stats.elemental_mastery.earth, 0.0);
        assert_eq!(result.stats.elemental_mastery.air, 0.0);
    }

    #[test]
    fn skips_known_conditional_initial_passive_notes() {
        let result = apply_initial_passive_effects(
            BaseStats::default(),
            ResourcePool::default(),
            &[
                PassiveEntry {
                    id: "carnage".to_string(),
                    effects: vec![PassiveEffect::StatModifier {
                        stat: "damageInflictedPercent".to_string(),
                        amount: 15.0,
                        target: None,
                        element: None,
                        note: Some("Aux cibles ayant de l'Armure.".to_string()),
                    }],
                },
                PassiveEntry {
                    id: "inspiration".to_string(),
                    effects: vec![PassiveEffect::StatModifier {
                        stat: "damageInflictedPercent".to_string(),
                        amount: 10.0,
                        target: None,
                        element: None,
                        note: Some("Aux combattants ayant plus d'Initiative.".to_string()),
                    }],
                },
            ],
        );

        assert_eq!(result.stats.damage_inflicted_percent, 0.0);
    }

    #[test]
    fn applies_huppermage_bq_gain_passive_multipliers() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![
                "transcendance-runique".to_string(),
                "profusion-runique".to_string(),
            ],
        );
        state.runes.active = RuneTracker {
            incandescent: true,
            aquatic: true,
            telluric: true,
            aerial: true,
        };

        let turn_end = apply_turn_end_bq(
            state,
            ResourcePool {
                ap: 0,
                mp: 0,
                wp: 6,
                bq: 100,
            },
        );

        assert_eq!(turn_end.amount, 160);
        assert_eq!(turn_end.resources.bq, 260);
    }

    #[test]
    fn validates_cooldowns_and_ages_them_between_turns() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        let spell = SpellRules {
            id: "cooldown-spell".to_string(),
            element: Some(Element::Fire),
            is_deck_tracked: true,
            max_casts_per_turn: None,
            max_casts_per_target: None,
            cooldown_turns: Some(2),
            required_target: None,
        };
        apply_spell_cooldown(&mut state.cooldowns_by_spell_id, &spell);

        let violation =
            validate_spell_rules(&spell, 0, None, &BTreeMap::new(), &BTreeMap::new(), &state)
                .expect("cooldown should block");

        assert_eq!(violation.violation_type, "cooldownActive");
        assert_eq!(violation.available, Some(2));

        let aged = age_cooldowns(&state.cooldowns_by_spell_id, &BTreeMap::new());
        assert_eq!(aged.get("cooldown-spell"), Some(&1));
    }

    #[test]
    fn validates_turn_and_target_cast_limits() {
        let state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        let spell = SpellRules {
            id: "limited".to_string(),
            element: Some(Element::Fire),
            is_deck_tracked: false,
            max_casts_per_turn: Some(2),
            max_casts_per_target: Some(1),
            cooldown_turns: None,
            required_target: None,
        };
        let mut casts = BTreeMap::new();
        casts.insert("limited".to_string(), 2);
        let mut target_casts = BTreeMap::new();
        target_casts.insert("limited".to_string(), 1);

        let target_violation =
            validate_spell_rules(&spell, 1, None, &BTreeMap::new(), &target_casts, &state)
                .expect("target limit should win");
        assert_eq!(target_violation.scope, Some("target".to_string()));

        let turn_violation =
            validate_spell_rules(&spell, 1, None, &casts, &BTreeMap::new(), &state)
                .expect("turn limit should block");
        assert_eq!(turn_violation.scope, Some("turn".to_string()));
    }

    #[test]
    fn validates_required_targets() {
        let state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        let spell = SpellRules {
            id: "cell-only".to_string(),
            element: Some(Element::Fire),
            is_deck_tracked: false,
            max_casts_per_turn: None,
            max_casts_per_target: None,
            cooldown_turns: None,
            required_target: Some(ActionTargetKind::EmptyCell),
        };

        let violation = validate_spell_rules(
            &spell,
            3,
            Some(ActionTargetKind::Enemy),
            &BTreeMap::new(),
            &BTreeMap::new(),
            &state,
        )
        .expect("target should be invalid");

        assert_eq!(violation.violation_type, "invalidTarget");
        assert_eq!(violation.spell_id, Some("cell-only".to_string()));
    }

    #[test]
    fn validates_deck_limits_and_temporary_unlocks() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        state.deck_spell_limit = 1;
        state.used_spell_ids = vec!["first".to_string()];
        let spell = SpellRules {
            id: "second".to_string(),
            element: Some(Element::Earth),
            is_deck_tracked: true,
            max_casts_per_turn: None,
            max_casts_per_target: None,
            cooldown_turns: None,
            required_target: None,
        };

        let violation =
            validate_spell_rules(&spell, 0, None, &BTreeMap::new(), &BTreeMap::new(), &state)
                .expect("deck should be full");
        assert_eq!(violation.violation_type, "deckLimitExceeded");

        state.temporary_unlocked_spell_element = Some(Element::Earth);
        assert_eq!(
            validate_spell_rules(&spell, 0, None, &BTreeMap::new(), &BTreeMap::new(), &state),
            None
        );

        let state_after = add_used_spell_id(state, &spell);
        assert_eq!(state_after.used_spell_ids, vec!["first".to_string()]);
    }

    #[test]
    fn carries_resources_and_huppermage_state_to_next_turn() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        state.runes.active.incandescent = true;
        state.rune_ap_gains_this_turn.incandescent = true;
        state.active_heart = Some(HuppermageHeart::Fire);
        state
            .cooldowns_by_spell_id
            .insert("cooldown-spell".to_string(), 2);
        let casts = BTreeMap::new();

        let next = create_next_turn_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            ResourcePool {
                ap: 0,
                mp: 1,
                wp: 4,
                bq: 725,
            },
            state,
            &casts,
        );

        assert_eq!(next.resources.ap, 12);
        assert_eq!(next.resources.mp, 6);
        assert_eq!(next.resources.wp, 4);
        assert_eq!(next.resources.bq, 725);
        assert!(next.huppermage.runes.active.incandescent);
        assert!(!next.huppermage.rune_ap_gains_this_turn.incandescent);
        assert_eq!(next.huppermage.active_heart, None);
        assert_eq!(
            next.huppermage.cooldowns_by_spell_id.get("cooldown-spell"),
            Some(&1)
        );
    }

    #[test]
    fn keeps_cast_cooldown_from_aging_on_the_cast_turn() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            vec![],
        );
        state
            .cooldowns_by_spell_id
            .insert("cooldown-spell".to_string(), 2);
        let mut casts = BTreeMap::new();
        casts.insert("cooldown-spell".to_string(), 1);

        let next = create_next_turn_state(
            ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            ResourcePool {
                ap: 0,
                mp: 0,
                wp: 6,
                bq: 500,
            },
            state,
            &casts,
        );

        assert_eq!(
            next.huppermage.cooldowns_by_spell_id.get("cooldown-spell"),
            Some(&2)
        );
    }

    #[test]
    fn records_combo_progress_and_stops_after_invalid_turn() {
        let violation = SimulationViolation {
            violation_type: "insufficientResource".to_string(),
            action_index: 2,
            spell_id: Some("burst".to_string()),
            required: Some(6),
            available: Some(2),
            scope: None,
            message: "not enough AP".to_string(),
        };
        let progress = record_combo_turn(
            ComboProgress {
                valid: true,
                ..Default::default()
            },
            100.125,
            None,
        );
        let invalid = record_combo_turn(progress, 50.0, Some(violation.clone()));
        let unchanged = record_combo_turn(invalid.clone(), 999.0, None);

        assert_eq!(invalid.valid, false);
        assert_eq!(invalid.completed_turns, 2);
        assert_eq!(invalid.total_damage, 150.13);
        assert_eq!(invalid.violations, vec![violation]);
        assert_eq!(unchanged, invalid);
    }

    #[test]
    fn scores_total_and_target_resolved_element_damage() {
        let damage_by_element = add_resolved_element_damage(
            add_resolved_element_damage(DamageByElement::default(), &Element::Fire, 125.125),
            &Element::Water,
            50.0,
        );
        let summary = SimulationSummary {
            valid: true,
            total_damage: 175.13,
            damage_by_resolved_element: damage_by_element,
            initial_resources: ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            final_resources: ResourcePool {
                ap: 0,
                mp: 6,
                wp: 6,
                bq: 500,
            },
        };

        let total = score_simulation(&summary, &ScoreCriterion::TotalDamage);
        assert_eq!(total.score, 175.13);

        let fire = score_simulation(
            &summary,
            &ScoreCriterion::TargetElementDamage {
                element: Element::Fire,
            },
        );
        assert_eq!(fire.score, 125.13);
        assert_eq!(fire.target_element, Some(Element::Fire));
        assert_eq!(fire.target_element_damage, Some(125.13));
    }

    #[test]
    fn evaluates_sustainable_replay_resources() {
        let first = SimulationSummary {
            valid: true,
            total_damage: 100.0,
            damage_by_resolved_element: DamageByElement::default(),
            initial_resources: ResourcePool {
                ap: 12,
                mp: 6,
                wp: 6,
                bq: 500,
            },
            final_resources: ResourcePool {
                ap: 0,
                mp: 6,
                wp: 4,
                bq: 600,
            },
        };
        let replay = SimulationSummary {
            valid: true,
            total_damage: 100.0,
            damage_by_resolved_element: DamageByElement::default(),
            initial_resources: first.final_resources,
            final_resources: ResourcePool {
                ap: 0,
                mp: 6,
                wp: 4,
                bq: 600,
            },
        };

        let sustainable = evaluate_sustainability(true, &first, &replay);
        assert!(sustainable.sustainable);

        let failing_replay = SimulationSummary {
            final_resources: ResourcePool {
                ap: 0,
                mp: 6,
                wp: 3,
                bq: 600,
            },
            ..replay
        };
        let unsustainable = evaluate_sustainability(true, &first, &failing_replay);
        assert!(!unsustainable.sustainable);

        let optional = evaluate_sustainability(false, &first, &failing_replay);
        assert!(optional.sustainable);
    }
}
