use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
use wasm_bindgen::prelude::*;

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePool {
    #[serde(default)]
    pub ap: f64,
    #[serde(default)]
    pub mp: f64,
    #[serde(default)]
    pub wp: f64,
    #[serde(default)]
    pub bq: f64,
}

impl ResourcePool {
    fn amount(&self, resource: &str) -> Option<f64> {
        match resource {
            "ap" => Some(self.ap),
            "mp" => Some(self.mp),
            "wp" => Some(self.wp),
            "bq" => Some(self.bq),
            _ => None,
        }
    }

    fn add_resource(&mut self, resource: &str, amount: f64) -> bool {
        match resource {
            "ap" => self.ap += amount,
            "mp" => self.mp += amount,
            "wp" => self.wp += amount,
            "bq" => self.bq += amount,
            _ => return false,
        }
        true
    }

    fn add_resource_clamped_min(&mut self, resource: &str, amount: f64, min_value: f64) -> bool {
        match resource {
            "ap" => self.ap = (self.ap + amount).max(min_value),
            "mp" => self.mp = (self.mp + amount).max(min_value),
            "wp" => self.wp = (self.wp + amount).max(min_value),
            "bq" => self.bq = (self.bq + amount).max(min_value),
            _ => return false,
        }
        true
    }

    fn can_afford(&self, cost: SpellCost) -> bool {
        cost.non_negative_amounts()
            .into_iter()
            .all(|(resource, required)| {
                self.amount(resource)
                    .is_some_and(|available| required <= available)
            })
    }

    fn pay(self, cost: SpellCost) -> Self {
        let mut resources = self;
        for (resource, amount) in cost.amounts() {
            resources.add_resource(resource, -amount);
        }
        resources
    }

    fn pay_non_negative(&mut self, cost: SpellCost) {
        for (resource, amount) in cost.non_negative_amounts() {
            self.add_resource(resource, -amount);
        }
    }
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

impl SpellCost {
    fn amounts(&self) -> [(&'static str, f64); 4] {
        [
            ("ap", f64::from(self.ap)),
            ("mp", f64::from(self.mp)),
            ("wp", f64::from(self.wp)),
            ("bq", f64::from(self.bq)),
        ]
    }

    fn non_negative_amounts(&self) -> [(&'static str, f64); 4] {
        [
            ("ap", f64::from(self.ap.max(0))),
            ("mp", f64::from(self.mp.max(0))),
            ("wp", f64::from(self.wp.max(0))),
            ("bq", f64::from(self.bq.max(0))),
        ]
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PartialActionContext {
    #[serde(default)]
    pub position: Option<AttackPosition>,
    #[serde(default)]
    pub range_mode: Option<RangeMode>,
    #[serde(default)]
    pub is_critical: Option<bool>,
    #[serde(default)]
    pub critical_mode: Option<CriticalEvaluationMode>,
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
    pub critical_mode: CriticalEvaluationMode,
    pub is_berserk: bool,
    pub is_blocked: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CriticalEvaluationMode {
    Expected,
    ForcedCritical,
    ForcedNonCritical,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AttackPosition {
    Face,
    Side,
    Rear,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RangeMode {
    Melee,
    Distance,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, PartialOrd, Ord)]
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

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum HuppermageWaterHeartSpellKind {
    Light,
    Elemental,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub water_heart_last_spell_kind: Option<HuppermageWaterHeartSpellKind>,
    #[serde(default, skip_serializing_if = "is_zero_u32")]
    pub halo_chatoyant_marks: u32,
    pub bq_max: f64,
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
    pub before: f64,
    pub after: f64,
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
    pub initial_wp: f64,
    pub final_wp: f64,
    pub initial_bq: f64,
    pub final_bq: f64,
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
    pub critical_mode: CriticalEvaluationMode,
    pub effective_critical_hit_percent: f64,
    pub non_critical_result: f64,
    pub critical_result: f64,
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
    pub required: f64,
    pub available: f64,
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

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
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
    pub max_sublimation_count: u32,
    #[serde(default)]
    pub available_spell_ids: Vec<String>,
    #[serde(default)]
    pub available_passive_ids: Vec<String>,
    #[serde(default)]
    pub available_sublimation_ids: Vec<String>,
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
    #[serde(default)]
    pub resume_state: Option<HybridSearchResumeState>,
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

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridCandidateBatchResponse {
    pub schema_version: u32,
    pub backend: String,
    pub supported: bool,
    pub engine: String,
    pub seed: String,
    pub attempts: u32,
    pub candidates: Vec<OptimizerCandidateInput>,
    pub metrics: BTreeMap<String, u32>,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridSearchResponse {
    pub schema_version: u32,
    pub backend: String,
    pub supported: bool,
    pub engine: String,
    pub seed: String,
    pub attempts: u32,
    pub valid_candidates: u32,
    pub invalid_candidates: u32,
    pub top_candidates: Vec<ScoredTopCandidateEntry>,
    pub metrics: BTreeMap<String, u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resume_state: Option<HybridSearchResumeState>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridSearchResumeState {
    pub schema_version: u32,
    #[serde(default)]
    pub total_attempts: u64,
    #[serde(default)]
    pub islands: Vec<HybridIslandResumeState>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridIslandResumeState {
    pub island_index: u32,
    pub seed: String,
    pub rng_state: u32,
    pub warmup_index: usize,
    pub restart_index: u32,
    pub attempts_since_improvement: u32,
    pub consecutive_repair_attempts: u32,
    pub consecutive_elite_neighbor_attempts: u32,
    #[serde(default)]
    pub population: Vec<HybridPopulationEntry>,
    #[serde(default)]
    pub repair_queue: Vec<OptimizerCandidateInput>,
    #[serde(default)]
    pub elite_neighbor_queue: Vec<OptimizerCandidateInput>,
}

#[derive(Clone, Debug)]
struct DomainSeedCandidate {
    passive_ids: Vec<&'static str>,
    turns: Vec<Vec<&'static str>>,
    max_duration: Option<u32>,
    min_passive_count: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateEvaluationViolation {
    pub turn_index: u32,
    pub violation_type: String,
    pub action_index: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spell_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateEvaluationResult {
    pub candidate_id: String,
    pub valid: bool,
    pub total_damage: f64,
    pub final_resources: ResourcePool,
    pub final_huppermage: HuppermageState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<CandidateScoreBreakdown>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_violation: Option<CandidateEvaluationViolation>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateScoreBreakdown {
    pub score: f64,
    pub total_damage: f64,
    pub damage_by_resolved_element: DamageByElement,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScoredTopCandidateEntry {
    pub id: String,
    pub passive_ids: Vec<String>,
    #[serde(default)]
    pub sublimation_ids: Vec<String>,
    pub plan: CandidatePlan,
    pub score: CandidateScoreBreakdown,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CandidateEvaluationInput {
    pub id: String,
    #[serde(default)]
    pub passive_ids: Vec<String>,
    #[serde(default)]
    pub sublimation_ids: Vec<String>,
    pub plan: CandidatePlan,
}

#[derive(Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackendMetrics {
    pub request_catalog_entries: u32,
    pub request_available_spells: u32,
    pub request_available_passives: u32,
    pub request_available_sublimations: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridIslandSchedule {
    pub island_index: u32,
    pub iterations: u32,
    pub progress_interval: u32,
    pub rng_seed: String,
    pub sampler_seed: String,
    pub population_size: u32,
    pub elite_count: u32,
    pub immigrant_batch_size: u32,
    pub stagnation_limit: u32,
    pub local_refinement_interval: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridSearchSchedule {
    pub island_count: u32,
    pub islands: Vec<HybridIslandSchedule>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridPopulationConfig {
    pub population_size: u32,
    pub elite_count: u32,
    pub immigrant_batch_size: u32,
    pub stagnation_limit: u32,
    pub local_refinement_interval: u32,
    pub local_refinement_preemption_budget: u32,
    pub stagnation_refinement_budget: u32,
    pub stagnation_refinement_interval: u32,
    pub repair_burst_limit: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridPopulationEntry {
    pub id: String,
    pub candidate: OptimizerCandidateInput,
    pub score: f64,
    #[serde(default)]
    pub valid: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridImmigrant {
    pub mode: String,
    pub candidate: OptimizerCandidateInput,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridRestartResult {
    pub retained_elites: Vec<HybridPopulationEntry>,
    pub immigrants: Vec<HybridImmigrant>,
    pub next_population: Vec<HybridPopulationEntry>,
    pub attempts_since_improvement: u32,
    pub metrics: BTreeMap<String, u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridViolationInput {
    pub violation_type: String,
    pub turn_index: u32,
    pub action_index: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridRepairQueueResult {
    pub queue: Vec<OptimizerCandidateInput>,
    pub enqueued: bool,
    pub metrics: BTreeMap<String, u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HybridNeighborResult {
    pub queue: Vec<OptimizerCandidateInput>,
    pub generated: u32,
    pub metrics: BTreeMap<String, u32>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatorCacheMetrics {
    pub cache_hits: u32,
    pub cache_misses: u32,
    pub cache_evictions: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatorCacheEntry {
    pub key: String,
    pub value: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatorCacheSnapshot {
    pub limit: usize,
    pub entries: Vec<EvaluatorCacheEntry>,
    pub metrics: EvaluatorCacheMetrics,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatorCacheAccess {
    pub hit: bool,
    pub value: Value,
    pub cache: EvaluatorCacheSnapshot,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopCandidateEntry {
    pub id: String,
    pub candidate: OptimizerCandidateInput,
    pub score: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopCandidateTrackerSnapshot {
    pub max_candidates: usize,
    pub candidates: Vec<TopCandidateEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TopCandidateUpdate {
    pub accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub removed_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_candidate: Option<TopCandidateEntry>,
    pub tracker: TopCandidateTrackerSnapshot,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressCheckpoint {
    pub attempts: u32,
    pub valid_candidates: u32,
    pub invalid_candidates: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_score: Option<f64>,
    #[serde(default)]
    pub best_changed: bool,
    #[serde(default)]
    pub metrics: BTreeMap<String, f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSnapshot {
    pub engine: String,
    pub attempts: u32,
    pub valid_candidates: u32,
    pub invalid_candidates: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_score: Option<f64>,
    pub top_candidates: Vec<TopCandidateEntry>,
    pub metrics: BTreeMap<String, f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressBatchInput {
    pub engine: String,
    pub progress_interval: u32,
    #[serde(default)]
    pub top_candidates: Vec<TopCandidateEntry>,
    #[serde(default)]
    pub checkpoints: Vec<ProgressCheckpoint>,
    #[serde(default)]
    pub include_final: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OptimizerCandidateInput {
    #[serde(default)]
    pub passive_ids: Vec<String>,
    #[serde(default)]
    pub sublimation_ids: Vec<String>,
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
    #[serde(default)]
    pub context: Option<PartialActionContext>,
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

    pub fn from_state(state: u32) -> Self {
        Self { state }
    }

    pub fn state_snapshot(&self) -> u32 {
        self.state
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
    candidate.passive_ids.dedup();
    candidate.sublimation_ids.sort();
    candidate.sublimation_ids.dedup();
    candidate
}

pub fn encode_candidate(candidate: &OptimizerCandidateInput) -> String {
    let mut passive_ids = candidate.passive_ids.clone();
    passive_ids.sort();
    let mut sublimation_ids = candidate.sublimation_ids.clone();
    sublimation_ids.sort();
    format!(
        "{}::{}::{}",
        passive_ids.join("+"),
        sublimation_ids.join("+"),
        candidate
            .plan
            .turns
            .iter()
            .map(encode_candidate_turn)
            .collect::<Vec<_>>()
            .join("|")
    )
}

pub fn create_evaluation_cache_key(prefix: &str, candidate: &OptimizerCandidateInput) -> String {
    format!("{prefix}{}", encode_candidate(candidate))
}

fn hash_candidate(candidate: &OptimizerCandidateInput) -> u128 {
    let mut hash = 0x6c62_272e_07bb_0142_62b8_2175_6295_c58d_u128;
    for passive_id in &candidate.passive_ids {
        hash_candidate_bytes(&mut hash, passive_id.as_bytes());
        hash_candidate_byte(&mut hash, b'+');
    }
    hash_candidate_byte(&mut hash, b':');
    for sublimation_id in &candidate.sublimation_ids {
        hash_candidate_bytes(&mut hash, sublimation_id.as_bytes());
        hash_candidate_byte(&mut hash, b'+');
    }
    hash_candidate_byte(&mut hash, b':');
    for turn in &candidate.plan.turns {
        for action in &turn.actions {
            hash_candidate_bytes(&mut hash, action.spell_id.as_bytes());
            if let Some(target) = &action.target {
                hash_candidate_byte(&mut hash, b'@');
                hash_candidate_byte(&mut hash, action_target_hash_byte(&target.kind));
            }
            hash_candidate_byte(&mut hash, b',');
        }
        hash_candidate_byte(&mut hash, b'|');
    }
    hash
}

fn hash_candidate_bytes(hash: &mut u128, bytes: &[u8]) {
    for byte in bytes {
        hash_candidate_byte(hash, *byte);
    }
}

fn hash_candidate_byte(hash: &mut u128, byte: u8) {
    *hash ^= byte as u128;
    *hash = hash.wrapping_mul(0x0000_0000_0100_0000_0000_0000_0000_013b_u128);
}

fn action_target_hash_byte(kind: &ActionTargetKind) -> u8 {
    match kind {
        ActionTargetKind::EmptyCell => 1,
        ActionTargetKind::FeuFollet => 2,
        ActionTargetKind::Fighter => 3,
        ActionTargetKind::Ally => 4,
        ActionTargetKind::Enemy => 5,
    }
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

pub fn create_hybrid_schedule(request: &OptimizerRequest) -> HybridSearchSchedule {
    let island_count = get_hybrid_island_count(request.iterations, request.duration);
    let base_iterations = request.iterations / island_count;
    let remainder = request.iterations % island_count;
    let islands = (0..island_count)
        .map(|island_index| {
            let iterations = base_iterations + u32::from(island_index < remainder);
            let population = create_hybrid_population_config(iterations);
            HybridIslandSchedule {
                island_index,
                iterations,
                progress_interval: std::cmp::max(1, iterations / 10),
                rng_seed: format!("{}:hybrid:island:{island_index}", request.seed),
                sampler_seed: format!("{}:hybrid:sampler:{island_index}", request.seed),
                population_size: population.population_size,
                elite_count: population.elite_count,
                immigrant_batch_size: population.immigrant_batch_size,
                stagnation_limit: population.stagnation_limit,
                local_refinement_interval: population.local_refinement_interval,
            }
        })
        .collect();

    HybridSearchSchedule {
        island_count,
        islands,
    }
}

pub fn get_hybrid_island_count(iterations: u32, duration: u32) -> u32 {
    if iterations < 80 || (duration <= 2 && iterations < 120) {
        return 1;
    }

    std::cmp::min(
        6,
        std::cmp::max(2, ((iterations as f64).sqrt() / 5.0).floor() as u32),
    )
}

pub fn create_hybrid_population_config(iterations: u32) -> HybridPopulationConfig {
    let population_size = std::cmp::max(
        8,
        std::cmp::min(96, ((iterations as f64).sqrt().floor() as u32) * 2),
    );
    HybridPopulationConfig {
        population_size,
        elite_count: std::cmp::max(2, ((population_size as f64) * 0.15).ceil() as u32),
        immigrant_batch_size: std::cmp::max(2, ((population_size as f64) * 0.25).ceil() as u32),
        stagnation_limit: std::cmp::max(
            8,
            std::cmp::min(80, ((population_size as f64) * 2.0).ceil() as u32),
        ),
        local_refinement_interval: std::cmp::max(3, population_size / 4),
        local_refinement_preemption_budget: 160,
        stagnation_refinement_budget: 1_000,
        stagnation_refinement_interval: 7,
        repair_burst_limit: 2,
    }
}

pub fn rank_population(mut population: Vec<HybridPopulationEntry>) -> Vec<HybridPopulationEntry> {
    population.sort_by(compare_population_entries);
    population
}

pub fn truncate_population(
    population: Vec<HybridPopulationEntry>,
    population_size: u32,
) -> Vec<HybridPopulationEntry> {
    rank_population(population)
        .into_iter()
        .take(population_size as usize)
        .collect()
}

pub fn inject_hybrid_immigrants(
    request: &OptimizerRequest,
    population: Vec<HybridPopulationEntry>,
    restart_index: u32,
) -> Result<HybridRestartResult, String> {
    let catalog = read_search_catalog(request)?;
    let actions = get_search_actions(request, &catalog);
    if actions.is_empty() {
        return Err("Cannot inject Rust hybrid immigrants without available spells.".to_string());
    }
    inject_hybrid_immigrants_with_catalog(request, &catalog, &actions, population, restart_index)
}

fn inject_hybrid_immigrants_with_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    population: Vec<HybridPopulationEntry>,
    restart_index: u32,
) -> Result<HybridRestartResult, String> {
    let config = create_hybrid_population_config(request.iterations);
    let retained_elites = truncate_population(population, config.elite_count);
    let mut next_population = retained_elites.clone();
    let mut immigrants = Vec::new();
    let mut metrics = BTreeMap::new();
    let mut rng = SeededRandom::new(&format!("{}:hybrid:restart:{restart_index}", request.seed));

    while immigrants.len() < config.immigrant_batch_size as usize
        && next_population.len() < config.population_size as usize
    {
        let use_diverse = request.iterations >= 1_000
            && request.duration <= 2
            && immigrants.is_empty()
            && !next_population.is_empty();
        let (mode, candidate) = if use_diverse {
            *metrics
                .entry("hybridDiverseImmigrants".to_string())
                .or_insert(0) += 1;
            (
                "diverseRandom".to_string(),
                create_hybrid_diverse_immigrant_with_catalog(
                    request,
                    catalog,
                    actions,
                    &next_population,
                    &mut rng,
                )?,
            )
        } else if rng.chance(0.12) {
            *metrics
                .entry("hybridResourceAwareCandidates".to_string())
                .or_insert(0) += 1;
            (
                "resourceAware".to_string(),
                sample_candidate_with_rng_from_catalog(
                    request,
                    catalog,
                    actions,
                    "resourceAware",
                    &mut rng,
                )?,
            )
        } else {
            (
                "random".to_string(),
                sample_candidate_with_rng_from_catalog(
                    request, catalog, actions, "random", &mut rng,
                )?,
            )
        };

        let id = encode_candidate(&candidate);
        next_population.push(HybridPopulationEntry {
            id: id.clone(),
            candidate: candidate.clone(),
            score: f64::NEG_INFINITY,
            valid: false,
        });
        immigrants.push(HybridImmigrant { mode, candidate });
    }

    metrics.insert("hybridRestarts".to_string(), 1);
    metrics.insert("hybridImmigrants".to_string(), immigrants.len() as u32);

    Ok(HybridRestartResult {
        retained_elites,
        immigrants,
        next_population,
        attempts_since_improvement: config.stagnation_limit / 2,
        metrics,
    })
}

pub fn crossover_candidates(
    request: &OptimizerRequest,
    parent_a: &OptimizerCandidateInput,
    parent_b: &OptimizerCandidateInput,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let catalog = read_search_catalog(request)?;
    crossover_candidates_with_catalog(request, &catalog, parent_a, parent_b, rng)
}

fn crossover_candidates_with_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    parent_a: &OptimizerCandidateInput,
    parent_b: &OptimizerCandidateInput,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let turns = parent_a
        .plan
        .turns
        .iter()
        .enumerate()
        .map(|(index, turn)| {
            if rng.chance(0.5) {
                turn.clone()
            } else {
                parent_b
                    .plan
                    .turns
                    .get(index)
                    .cloned()
                    .unwrap_or_else(|| turn.clone())
            }
        })
        .collect();
    let passive_ids = crossover_passive_ids(
        &parent_a.passive_ids,
        &parent_b.passive_ids,
        request,
        catalog,
        rng,
    );
    let sublimation_ids = crossover_sublimation_ids(
        &parent_a.sublimation_ids,
        &parent_b.sublimation_ids,
        request,
        rng,
    );

    Ok(OptimizerCandidateInput {
        passive_ids,
        sublimation_ids,
        plan: CandidatePlan { turns },
    })
}

pub fn mutate_candidate(
    request: &OptimizerRequest,
    candidate: &OptimizerCandidateInput,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let catalog = read_search_catalog(request)?;
    let actions = get_search_actions(request, &catalog);
    if actions.is_empty() {
        return Err("Cannot mutate Rust candidate without available spells.".to_string());
    }
    mutate_candidate_with_catalog(request, &catalog, &actions, candidate, rng)
}

fn mutate_candidate_with_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    candidate: &OptimizerCandidateInput,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let mut next = candidate.clone();
    if rng.chance(0.35) {
        next.passive_ids = mutate_passive_ids(&next.passive_ids, request, catalog, rng);
    }
    if rng.chance(0.25) {
        next.sublimation_ids = mutate_sublimation_ids(&next.sublimation_ids, request, rng);
    }

    let Some(turn_index) = select_mutation_turn_index(request, &next, rng) else {
        return Ok(create_random_candidate(request, catalog, actions, rng));
    };
    if next.plan.turns.get(turn_index).is_none() {
        return Ok(create_random_candidate(request, catalog, actions, rng));
    }

    if request.duration >= 2 && request.iterations >= 80 {
        let target_flip_spell_ids = actions
            .iter()
            .filter(|action| {
                action
                    .target
                    .as_ref()
                    .is_some_and(|target| target.kind == ActionTargetKind::EmptyCell)
            })
            .map(|action| action.spell_id.clone())
            .collect::<BTreeSet<_>>();

        let flippable_turn_index = if request.iterations >= 160
            && !turn_has_target_flip(&next.plan.turns[turn_index], &target_flip_spell_ids)
        {
            next.plan
                .turns
                .iter()
                .position(|turn| turn_has_target_flip(turn, &target_flip_spell_ids))
                .unwrap_or(turn_index)
        } else {
            turn_index
        };
        let flippable_indexes = next.plan.turns[flippable_turn_index]
            .actions
            .iter()
            .enumerate()
            .filter(|(_, action)| target_flip_spell_ids.contains(&action.spell_id))
            .map(|(index, _)| index)
            .collect::<Vec<_>>();

        if !flippable_indexes.is_empty() {
            let index = *rng.pick(&flippable_indexes);
            let action = &mut next.plan.turns[flippable_turn_index].actions[index];
            action.target = if action
                .target
                .as_ref()
                .is_some_and(|target| target.kind == ActionTargetKind::EmptyCell)
            {
                None
            } else {
                Some(CandidateActionTarget {
                    kind: ActionTargetKind::EmptyCell,
                })
            };
            return Ok(next);
        }
    }

    let turn = next
        .plan
        .turns
        .get_mut(turn_index)
        .expect("turn should exist after index check");
    if rng.chance(0.25) && turn.actions.len() < request.max_actions_per_turn as usize {
        turn.actions.push(rng.pick(actions).clone());
        return Ok(next);
    }

    let delete_chance = if request.duration >= 3
        && turn.actions.len() >= ((request.max_actions_per_turn as f64) * 0.75).ceil() as usize
    {
        0.45
    } else {
        0.25
    };
    if rng.chance(delete_chance) && turn.actions.len() > 1 {
        let index = rng.integer(0, (turn.actions.len() - 1) as u32) as usize;
        turn.actions.remove(index);
        return Ok(next);
    }

    if !turn.actions.is_empty() {
        let index = rng.integer(0, (turn.actions.len() - 1) as u32) as usize;
        turn.actions[index] = rng.pick(actions).clone();
    }
    Ok(next)
}

pub fn create_hybrid_local_refinement(
    request: &OptimizerRequest,
    population: Vec<HybridPopulationEntry>,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let catalog = read_search_catalog(request)?;
    let actions = get_search_actions(request, &catalog);
    if actions.is_empty() {
        return Err("Cannot refine Rust candidate without available spells.".to_string());
    }
    create_hybrid_local_refinement_with_catalog(request, &catalog, &actions, &population, rng)
}

fn create_hybrid_local_refinement_with_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    population: &[HybridPopulationEntry],
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    if population.is_empty() {
        return sample_candidate_with_rng_from_catalog(request, catalog, actions, "random", rng);
    }

    let ranked = rank_population(population.to_vec());
    let parent_index = rng.integer(0, std::cmp::min(4, ranked.len() as u32 - 1)) as usize;
    let mut candidate = ranked[parent_index].candidate.clone();
    let mutation_count = rng.integer(1, 3);
    for _index in 0..mutation_count {
        candidate = mutate_candidate_with_catalog(request, catalog, actions, &candidate, rng)?;
    }
    Ok(candidate)
}

pub fn create_hybrid_repair_candidate(
    input: &OptimizerCandidateInput,
    violation: &HybridViolationInput,
) -> Option<OptimizerCandidateInput> {
    if violation.violation_type == "unknownSpell" {
        return None;
    }

    let turn_index = violation.turn_index as usize;
    let action_index = violation.action_index as usize;
    let turn = input.plan.turns.get(turn_index)?;
    if action_index >= turn.actions.len() || turn.actions.len() <= 1 {
        return None;
    }

    let mut candidate = input.clone();
    let actions = &mut candidate.plan.turns[turn_index].actions;
    let delete_count = if input.plan.turns.len() >= 2 {
        actions.len() - action_index
    } else {
        1
    };
    actions.drain(action_index..action_index + delete_count);
    Some(candidate)
}

pub fn enqueue_hybrid_repair_candidate(
    request: &OptimizerRequest,
    mut queue: Vec<OptimizerCandidateInput>,
    candidate: Option<OptimizerCandidateInput>,
) -> HybridRepairQueueResult {
    let mut metrics = BTreeMap::new();
    let Some(candidate) = candidate else {
        return HybridRepairQueueResult {
            queue,
            enqueued: false,
            metrics,
        };
    };

    if queue.len() >= 512 || (request.duration < 3 && request.iterations < 80) {
        return HybridRepairQueueResult {
            queue,
            enqueued: false,
            metrics,
        };
    }

    let key = encode_candidate(&normalize_candidate(candidate.clone()));
    if queue
        .iter()
        .any(|queued| encode_candidate(&normalize_candidate(queued.clone())) == key)
    {
        return HybridRepairQueueResult {
            queue,
            enqueued: false,
            metrics,
        };
    }

    queue.push(normalize_candidate(candidate));
    metrics.insert("hybridRepairQueueCandidates".to_string(), 1);
    HybridRepairQueueResult {
        queue,
        enqueued: true,
        metrics,
    }
}

pub fn enqueue_hybrid_elite_neighbors(
    request: &OptimizerRequest,
    queue: Vec<OptimizerCandidateInput>,
    input: &OptimizerCandidateInput,
) -> Result<HybridNeighborResult, String> {
    let catalog = read_search_catalog(request)?;
    enqueue_hybrid_elite_neighbors_with_catalog(request, &catalog, queue, input)
}

fn enqueue_hybrid_elite_neighbors_with_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    mut queue: Vec<OptimizerCandidateInput>,
    input: &OptimizerCandidateInput,
) -> Result<HybridNeighborResult, String> {
    let actions = get_top_weighted_actions(request, &catalog, 20);
    let mut seen = queue
        .iter()
        .map(|candidate| encode_candidate(&normalize_candidate(candidate.clone())))
        .collect::<BTreeSet<_>>();
    let mut metrics = BTreeMap::new();
    let mut generated = 0_u32;

    add_passive_neighbors(
        request,
        &catalog,
        &mut queue,
        input,
        &mut seen,
        &mut metrics,
        &mut generated,
    );
    add_sublimation_neighbors(
        request,
        &mut queue,
        input,
        &mut seen,
        &mut metrics,
        &mut generated,
    );

    for turn_index in (0..input.plan.turns.len()).rev() {
        let turn = &input.plan.turns[turn_index];

        for action_index in 0..turn.actions.len().saturating_sub(1) {
            if encode_candidate_action(&turn.actions[action_index])
                == encode_candidate_action(&turn.actions[action_index + 1])
            {
                continue;
            }
            let mut candidate = input.clone();
            candidate.plan.turns[turn_index]
                .actions
                .swap(action_index, action_index + 1);
            add_elite_neighbor(
                &mut queue,
                candidate,
                &mut seen,
                &mut metrics,
                &mut generated,
                Some("hybridOrderNeighborCandidates"),
            );
        }

        if turn.actions.len() > 1 {
            for action_index in 0..turn.actions.len() {
                let mut candidate = input.clone();
                candidate.plan.turns[turn_index]
                    .actions
                    .remove(action_index);
                add_elite_neighbor(
                    &mut queue,
                    candidate,
                    &mut seen,
                    &mut metrics,
                    &mut generated,
                    None,
                );
            }
        }

        if turn.actions.len() < request.max_actions_per_turn as usize {
            for action in actions.iter().take(4) {
                let mut candidate = input.clone();
                candidate.plan.turns[turn_index]
                    .actions
                    .push(action.clone());
                add_elite_neighbor(
                    &mut queue,
                    candidate,
                    &mut seen,
                    &mut metrics,
                    &mut generated,
                    None,
                );
            }
        }

        for action_index in 0..turn.actions.len() {
            for action in &actions {
                if encode_candidate_action(&turn.actions[action_index])
                    == encode_candidate_action(action)
                {
                    continue;
                }
                let mut candidate = input.clone();
                candidate.plan.turns[turn_index].actions[action_index] = action.clone();
                add_elite_neighbor(
                    &mut queue,
                    candidate,
                    &mut seen,
                    &mut metrics,
                    &mut generated,
                    Some("hybridReplacementNeighborCandidates"),
                );
            }
        }
    }

    Ok(HybridNeighborResult {
        queue,
        generated,
        metrics,
    })
}

pub struct EvaluatorCache {
    limit: usize,
    entries: BTreeMap<String, Value>,
    order: VecDeque<String>,
    metrics: EvaluatorCacheMetrics,
}

impl EvaluatorCache {
    pub fn new(limit: usize) -> Self {
        Self {
            limit,
            entries: BTreeMap::new(),
            order: VecDeque::new(),
            metrics: EvaluatorCacheMetrics::default(),
        }
    }

    pub fn from_snapshot(snapshot: EvaluatorCacheSnapshot) -> Self {
        let mut cache = Self {
            limit: snapshot.limit,
            entries: BTreeMap::new(),
            order: VecDeque::new(),
            metrics: snapshot.metrics,
        };
        for entry in snapshot.entries {
            cache.insert_without_metrics(entry.key, entry.value);
        }
        cache
    }

    pub fn get_or_insert(&mut self, key: String, value: Value) -> EvaluatorCacheAccess {
        if let Some(cached) = self.entries.get(&key).cloned() {
            self.metrics.cache_hits += 1;
            self.refresh_key(&key);
            return EvaluatorCacheAccess {
                hit: true,
                value: cached,
                cache: self.snapshot(),
            };
        }

        self.metrics.cache_misses += 1;
        self.insert_with_eviction(key, value.clone());
        EvaluatorCacheAccess {
            hit: false,
            value,
            cache: self.snapshot(),
        }
    }

    pub fn get(&mut self, key: &str) -> Option<Value> {
        if let Some(cached) = self.entries.get(key).cloned() {
            self.metrics.cache_hits += 1;
            self.refresh_key(key);
            Some(cached)
        } else {
            self.metrics.cache_misses += 1;
            None
        }
    }

    pub fn insert(&mut self, key: String, value: Value) {
        self.insert_with_eviction(key, value);
    }

    pub fn metrics(&self) -> EvaluatorCacheMetrics {
        self.metrics.clone()
    }

    pub fn snapshot(&self) -> EvaluatorCacheSnapshot {
        EvaluatorCacheSnapshot {
            limit: self.limit,
            entries: self
                .order
                .iter()
                .filter_map(|key| {
                    self.entries.get(key).map(|value| EvaluatorCacheEntry {
                        key: key.clone(),
                        value: value.clone(),
                    })
                })
                .collect(),
            metrics: self.metrics.clone(),
        }
    }

    fn insert_with_eviction(&mut self, key: String, value: Value) {
        if self.limit == 0 {
            return;
        }

        if self.entries.len() >= self.limit {
            if let Some(oldest_key) = self.order.pop_front() {
                if self.entries.remove(&oldest_key).is_some() {
                    self.metrics.cache_evictions += 1;
                }
            }
        }

        self.insert_without_metrics(key, value);
    }

    fn insert_without_metrics(&mut self, key: String, value: Value) {
        self.order.retain(|entry_key| entry_key != &key);
        self.entries.insert(key.clone(), value);
        self.order.push_back(key);
        while self.entries.len() > self.limit {
            if let Some(oldest_key) = self.order.pop_front() {
                self.entries.remove(&oldest_key);
            } else {
                break;
            }
        }
    }

    fn refresh_key(&mut self, key: &str) {
        self.order.retain(|entry_key| entry_key != key);
        self.order.push_back(key.to_string());
    }
}

pub fn update_top_candidates(
    mut tracker: TopCandidateTrackerSnapshot,
    candidate: TopCandidateEntry,
) -> TopCandidateUpdate {
    tracker.max_candidates = clamp_top_candidate_limit(tracker.max_candidates);
    tracker.candidates = deduplicate_top_candidates(tracker.candidates);

    let mut removed_id = None;
    if let Some(existing_index) = tracker
        .candidates
        .iter()
        .position(|entry| entry.id == candidate.id)
    {
        if compare_top_candidates(&candidate, &tracker.candidates[existing_index])
            != std::cmp::Ordering::Less
        {
            tracker.candidates.sort_by(compare_top_candidates);
            return TopCandidateUpdate {
                accepted: false,
                removed_id,
                best_candidate: tracker.candidates.first().cloned(),
                tracker,
            };
        }
        tracker.candidates.remove(existing_index);
    } else if tracker.candidates.len() >= tracker.max_candidates {
        tracker.candidates.sort_by(compare_top_candidates);
        let Some(worst) = tracker.candidates.last() else {
            return TopCandidateUpdate {
                accepted: false,
                removed_id,
                best_candidate: None,
                tracker,
            };
        };
        if compare_top_candidates(&candidate, worst) != std::cmp::Ordering::Less {
            return TopCandidateUpdate {
                accepted: false,
                removed_id,
                best_candidate: tracker.candidates.first().cloned(),
                tracker,
            };
        }
        removed_id = tracker.candidates.pop().map(|entry| entry.id);
    }

    tracker.candidates.push(candidate);
    tracker.candidates.sort_by(compare_top_candidates);
    tracker.candidates.truncate(tracker.max_candidates);

    TopCandidateUpdate {
        accepted: true,
        removed_id,
        best_candidate: tracker.candidates.first().cloned(),
        tracker,
    }
}

fn deduplicate_top_candidates(candidates: Vec<TopCandidateEntry>) -> Vec<TopCandidateEntry> {
    let mut by_id: BTreeMap<String, TopCandidateEntry> = BTreeMap::new();
    for candidate in candidates {
        match by_id.get(&candidate.id) {
            Some(existing)
                if compare_top_candidates(&candidate, existing) != std::cmp::Ordering::Less => {}
            _ => {
                by_id.insert(candidate.id.clone(), candidate);
            }
        }
    }
    let mut candidates = by_id.into_values().collect::<Vec<_>>();
    candidates.sort_by(compare_top_candidates);
    candidates
}

fn compare_top_candidates(
    left: &TopCandidateEntry,
    right: &TopCandidateEntry,
) -> std::cmp::Ordering {
    right
        .score
        .partial_cmp(&left.score)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| {
            left.candidate
                .passive_ids
                .len()
                .cmp(&right.candidate.passive_ids.len())
        })
        .then_with(|| {
            left.candidate
                .sublimation_ids
                .len()
                .cmp(&right.candidate.sublimation_ids.len())
        })
        .then_with(|| {
            count_candidate_actions(&left.candidate).cmp(&count_candidate_actions(&right.candidate))
        })
        .then_with(|| left.id.cmp(&right.id))
}

fn clamp_top_candidate_limit(max_candidates: usize) -> usize {
    max_candidates.clamp(1, 200)
}

pub fn emit_progress_snapshots(input: ProgressBatchInput) -> Vec<ProgressSnapshot> {
    let interval = input.progress_interval.max(1);
    let final_attempt = input
        .checkpoints
        .last()
        .map(|checkpoint| checkpoint.attempts);
    let mut last_emitted_attempt: Option<u32> = None;
    let mut snapshots = Vec::new();

    for checkpoint in input.checkpoints {
        let is_final = input.include_final && Some(checkpoint.attempts) == final_attempt;
        let should_emit =
            checkpoint.best_changed || checkpoint.attempts % interval == 0 || is_final;
        if !should_emit || last_emitted_attempt == Some(checkpoint.attempts) {
            continue;
        }

        last_emitted_attempt = Some(checkpoint.attempts);
        snapshots.push(ProgressSnapshot {
            engine: input.engine.clone(),
            attempts: checkpoint.attempts,
            valid_candidates: checkpoint.valid_candidates,
            invalid_candidates: checkpoint.invalid_candidates,
            best_score: checkpoint.best_score,
            top_candidates: input.top_candidates.clone(),
            metrics: checkpoint.metrics,
        });
    }

    snapshots
}

fn compare_population_entries(
    left: &HybridPopulationEntry,
    right: &HybridPopulationEntry,
) -> std::cmp::Ordering {
    right
        .score
        .partial_cmp(&left.score)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| {
            left.candidate
                .passive_ids
                .len()
                .cmp(&right.candidate.passive_ids.len())
        })
        .then_with(|| {
            left.candidate
                .sublimation_ids
                .len()
                .cmp(&right.candidate.sublimation_ids.len())
        })
        .then_with(|| {
            count_candidate_actions(&left.candidate).cmp(&count_candidate_actions(&right.candidate))
        })
        .then_with(|| left.id.cmp(&right.id))
}

fn count_candidate_actions(candidate: &OptimizerCandidateInput) -> usize {
    candidate
        .plan
        .turns
        .iter()
        .map(|turn| turn.actions.len())
        .sum()
}

fn sample_candidate_with_rng(
    request: &OptimizerRequest,
    mode: &str,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let catalog = read_search_catalog(request)?;
    let actions = get_search_actions(request, &catalog);
    if actions.is_empty() {
        return Err("Cannot sample Rust candidate without available spells.".to_string());
    }

    match mode {
        "random" => Ok(create_random_candidate(request, &catalog, &actions, rng)),
        "resourceAware" => Ok(create_resource_aware_candidate(
            request, &catalog, &actions, rng,
        )),
        _ => Err(format!(
            "Unknown Rust candidate sampler mode '{mode}'. Expected 'random' or 'resourceAware'."
        )),
    }
}

fn sample_candidate_with_rng_from_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    mode: &str,
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    match mode {
        "random" => Ok(create_random_candidate(request, catalog, actions, rng)),
        "resourceAware" => Ok(create_resource_aware_candidate(
            request, catalog, actions, rng,
        )),
        _ => Err(format!(
            "Unknown Rust candidate sampler mode '{mode}'. Expected 'random' or 'resourceAware'."
        )),
    }
}

fn create_hybrid_diverse_immigrant_with_catalog(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    population: &[HybridPopulationEntry],
    rng: &mut SeededRandom,
) -> Result<OptimizerCandidateInput, String> {
    let reference_descriptors = population
        .iter()
        .map(|entry| create_hybrid_input_descriptor(&entry.candidate))
        .collect::<Vec<_>>();
    let mut selected =
        sample_candidate_with_rng_from_catalog(request, catalog, actions, "random", rng)?;
    let mut selected_distance = distance_to_nearest_hybrid_descriptor(
        &create_hybrid_input_descriptor(&selected),
        &reference_descriptors,
    );

    for _index in 1..4 {
        let candidate =
            sample_candidate_with_rng_from_catalog(request, catalog, actions, "random", rng)?;
        let distance = distance_to_nearest_hybrid_descriptor(
            &create_hybrid_input_descriptor(&candidate),
            &reference_descriptors,
        );
        if distance > selected_distance {
            selected = candidate;
            selected_distance = distance;
        }
    }

    Ok(selected)
}

fn create_hybrid_input_descriptor(candidate: &OptimizerCandidateInput) -> Vec<String> {
    let mut descriptor = vec![
        format!("actions:{}", count_candidate_actions(candidate)),
        format!("passives:{}", {
            let mut passive_ids = candidate.passive_ids.clone();
            passive_ids.sort();
            passive_ids.join(",")
        }),
        format!("sublimations:{}", {
            let mut sublimation_ids = candidate.sublimation_ids.clone();
            sublimation_ids.sort();
            sublimation_ids.join(",")
        }),
    ];

    for (turn_index, turn) in candidate.plan.turns.iter().enumerate() {
        for action in &turn.actions {
            descriptor.push(format!("t{turn_index}:{}", encode_candidate_action(action)));
        }
    }

    descriptor
}

fn distance_to_nearest_hybrid_descriptor(descriptor: &[String], references: &[Vec<String>]) -> f64 {
    if references.is_empty() {
        return 1.0;
    }

    references.iter().fold(1.0, |nearest, reference| {
        nearest.min(descriptor_distance(descriptor, reference))
    })
}

fn descriptor_distance(left: &[String], right: &[String]) -> f64 {
    let left_set = left.iter().collect::<BTreeSet<_>>();
    let right_set = right.iter().collect::<BTreeSet<_>>();
    let union = left_set.union(&right_set).count();
    let intersection = left_set.intersection(&right_set).count();

    if union == 0 {
        0.0
    } else {
        1.0 - (intersection as f64 / union as f64)
    }
}

fn crossover_passive_ids(
    parent_a_passive_ids: &[String],
    parent_b_passive_ids: &[String],
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    rng: &mut SeededRandom,
) -> Vec<String> {
    let available = get_available_passive_ids(request, catalog)
        .into_iter()
        .collect::<BTreeSet<_>>();
    let mut inherited = parent_a_passive_ids
        .iter()
        .chain(parent_b_passive_ids.iter())
        .filter(|passive_id| available.contains(*passive_id))
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    inherited.sort();

    let mut selected = Vec::new();
    for passive_id in inherited {
        if selected.len() >= request.max_passive_count as usize {
            break;
        }
        let in_parent_a = parent_a_passive_ids.contains(&passive_id);
        let in_parent_b = parent_b_passive_ids.contains(&passive_id);
        if (in_parent_a && in_parent_b) || rng.chance(0.5) {
            selected.push(passive_id);
        }
    }

    selected.sort();
    selected
}

fn mutate_passive_ids(
    current_passive_ids: &[String],
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    rng: &mut SeededRandom,
) -> Vec<String> {
    let available_passive_ids = get_available_passive_ids(request, catalog);
    if available_passive_ids.is_empty() || request.max_passive_count == 0 {
        return Vec::new();
    }

    let available = available_passive_ids.iter().collect::<BTreeSet<_>>();
    let mut next = current_passive_ids
        .iter()
        .filter(|passive_id| available.contains(passive_id))
        .cloned()
        .collect::<BTreeSet<_>>();
    let missing = available_passive_ids
        .iter()
        .filter(|passive_id| !next.contains(*passive_id))
        .cloned()
        .collect::<Vec<_>>();
    let can_add = next.len()
        < std::cmp::min(
            request.max_passive_count as usize,
            available_passive_ids.len(),
        )
        && !missing.is_empty();
    let can_remove = !next.is_empty();

    if can_add && (!can_remove || rng.chance(0.45)) {
        next.insert(pick_weighted_passive_id(&missing, request, catalog, rng));
    } else if can_remove && (!can_add || rng.chance(0.35)) {
        let choices = next.iter().cloned().collect::<Vec<_>>();
        next.remove(rng.pick(&choices));
    } else if can_add && can_remove {
        let choices = next.iter().cloned().collect::<Vec<_>>();
        next.remove(rng.pick(&choices));
        next.insert(pick_weighted_passive_id(&missing, request, catalog, rng));
    }

    next.into_iter().collect()
}

fn crossover_sublimation_ids(
    parent_a_sublimation_ids: &[String],
    parent_b_sublimation_ids: &[String],
    request: &OptimizerRequest,
    rng: &mut SeededRandom,
) -> Vec<String> {
    let available = get_available_sublimation_ids(request)
        .into_iter()
        .collect::<BTreeSet<_>>();
    let mut inherited = parent_a_sublimation_ids
        .iter()
        .chain(parent_b_sublimation_ids.iter())
        .filter(|sublimation_id| available.contains(*sublimation_id))
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    inherited.sort();

    let mut selected = Vec::new();
    for sublimation_id in inherited {
        if selected.len() >= request.max_sublimation_count as usize {
            break;
        }
        let in_parent_a = parent_a_sublimation_ids.contains(&sublimation_id);
        let in_parent_b = parent_b_sublimation_ids.contains(&sublimation_id);
        if (in_parent_a && in_parent_b) || rng.chance(0.5) {
            selected.push(sublimation_id);
        }
    }

    selected.sort();
    selected
}

fn mutate_sublimation_ids(
    current_sublimation_ids: &[String],
    request: &OptimizerRequest,
    rng: &mut SeededRandom,
) -> Vec<String> {
    let available_sublimation_ids = get_available_sublimation_ids(request);
    if available_sublimation_ids.is_empty() || request.max_sublimation_count == 0 {
        return Vec::new();
    }

    let available = available_sublimation_ids.iter().collect::<BTreeSet<_>>();
    let mut next = current_sublimation_ids
        .iter()
        .filter(|sublimation_id| available.contains(sublimation_id))
        .cloned()
        .collect::<BTreeSet<_>>();
    let missing = available_sublimation_ids
        .iter()
        .filter(|sublimation_id| !next.contains(*sublimation_id))
        .cloned()
        .collect::<Vec<_>>();
    let can_add = next.len()
        < std::cmp::min(
            request.max_sublimation_count as usize,
            available_sublimation_ids.len(),
        )
        && !missing.is_empty();
    let can_remove = !next.is_empty();

    if can_add && (!can_remove || rng.chance(0.45)) {
        next.insert(pick_weighted_sublimation_id(&missing, rng));
    } else if can_remove && (!can_add || rng.chance(0.35)) {
        let choices = next.iter().cloned().collect::<Vec<_>>();
        next.remove(rng.pick(&choices));
    } else if can_add && can_remove {
        let choices = next.iter().cloned().collect::<Vec<_>>();
        next.remove(rng.pick(&choices));
        next.insert(pick_weighted_sublimation_id(&missing, rng));
    }

    next.into_iter().collect()
}

fn select_mutation_turn_index(
    request: &OptimizerRequest,
    candidate: &OptimizerCandidateInput,
    rng: &mut SeededRandom,
) -> Option<usize> {
    if candidate.plan.turns.is_empty() {
        return None;
    }

    if request.iterations >= 160
        && request.iterations < 240
        && request.duration == 3
        && request.max_actions_per_turn >= 12
        && request.max_passive_count > 3
        && rng.chance(0.25)
    {
        let max_action_count = candidate
            .plan
            .turns
            .iter()
            .map(|turn| turn.actions.len())
            .max()
            .unwrap_or(0);
        let densest_indexes = candidate
            .plan
            .turns
            .iter()
            .enumerate()
            .filter(|(_, turn)| turn.actions.len() == max_action_count)
            .map(|(index, _)| index)
            .collect::<Vec<_>>();
        return Some(*rng.pick(&densest_indexes));
    }

    Some(rng.integer(0, (candidate.plan.turns.len() - 1) as u32) as usize)
}

fn turn_has_target_flip(turn: &CandidateTurn, target_flip_spell_ids: &BTreeSet<String>) -> bool {
    turn.actions
        .iter()
        .any(|action| target_flip_spell_ids.contains(&action.spell_id))
}

fn add_passive_neighbors(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    queue: &mut Vec<OptimizerCandidateInput>,
    input: &OptimizerCandidateInput,
    seen: &mut BTreeSet<String>,
    metrics: &mut BTreeMap<String, u32>,
    generated: &mut u32,
) {
    let mut available_passive_ids = get_available_passive_ids(request, catalog);
    available_passive_ids.sort_by(|left, right| {
        get_passive_search_weight(right, request, catalog)
            .partial_cmp(&get_passive_search_weight(left, request, catalog))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let active_passive_ids = input
        .passive_ids
        .iter()
        .filter(|passive_id| available_passive_ids.contains(passive_id))
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let missing_passive_ids = available_passive_ids
        .iter()
        .filter(|passive_id| !active_passive_ids.contains(passive_id))
        .cloned()
        .collect::<Vec<_>>();
    let passive_limit = std::cmp::min(
        request.max_passive_count as usize,
        available_passive_ids.len(),
    );

    for passive_id in &active_passive_ids {
        let mut candidate = input.clone();
        candidate.passive_ids = active_passive_ids
            .iter()
            .filter(|active_passive_id| *active_passive_id != passive_id)
            .cloned()
            .collect();
        add_elite_neighbor(
            queue,
            candidate,
            seen,
            metrics,
            generated,
            Some("hybridPassiveNeighborCandidates"),
        );
    }

    if active_passive_ids.len() < passive_limit {
        for passive_id in missing_passive_ids.iter().take(12) {
            let mut candidate = input.clone();
            candidate.passive_ids = active_passive_ids
                .iter()
                .cloned()
                .chain(std::iter::once(passive_id.clone()))
                .collect();
            candidate.passive_ids.sort();
            add_elite_neighbor(
                queue,
                candidate,
                seen,
                metrics,
                generated,
                Some("hybridPassiveNeighborCandidates"),
            );
        }
    }

    for passive_id in &active_passive_ids {
        for replacement_passive_id in missing_passive_ids.iter().take(8) {
            let mut candidate = input.clone();
            candidate.passive_ids = active_passive_ids
                .iter()
                .filter(|active_passive_id| *active_passive_id != passive_id)
                .cloned()
                .chain(std::iter::once(replacement_passive_id.clone()))
                .collect();
            candidate.passive_ids.sort();
            add_elite_neighbor(
                queue,
                candidate,
                seen,
                metrics,
                generated,
                Some("hybridPassiveNeighborCandidates"),
            );
        }
    }
}

fn add_sublimation_neighbors(
    request: &OptimizerRequest,
    queue: &mut Vec<OptimizerCandidateInput>,
    input: &OptimizerCandidateInput,
    seen: &mut BTreeSet<String>,
    metrics: &mut BTreeMap<String, u32>,
    generated: &mut u32,
) {
    let available_sublimation_ids = get_available_sublimation_ids(request);
    let active_sublimation_ids = input
        .sublimation_ids
        .iter()
        .filter(|sublimation_id| available_sublimation_ids.contains(sublimation_id))
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let missing_sublimation_ids = available_sublimation_ids
        .iter()
        .filter(|sublimation_id| !active_sublimation_ids.contains(sublimation_id))
        .cloned()
        .collect::<Vec<_>>();
    let sublimation_limit = std::cmp::min(
        request.max_sublimation_count as usize,
        available_sublimation_ids.len(),
    );

    for sublimation_id in &active_sublimation_ids {
        let mut candidate = input.clone();
        candidate.sublimation_ids = active_sublimation_ids
            .iter()
            .filter(|active_sublimation_id| *active_sublimation_id != sublimation_id)
            .cloned()
            .collect();
        add_elite_neighbor(
            queue,
            candidate,
            seen,
            metrics,
            generated,
            Some("hybridSublimationNeighborCandidates"),
        );
    }

    if active_sublimation_ids.len() < sublimation_limit {
        for sublimation_id in missing_sublimation_ids.iter().take(12) {
            let mut candidate = input.clone();
            candidate.sublimation_ids = active_sublimation_ids
                .iter()
                .cloned()
                .chain(std::iter::once(sublimation_id.clone()))
                .collect();
            candidate.sublimation_ids.sort();
            add_elite_neighbor(
                queue,
                candidate,
                seen,
                metrics,
                generated,
                Some("hybridSublimationNeighborCandidates"),
            );
        }
    }

    for sublimation_id in &active_sublimation_ids {
        for replacement_sublimation_id in missing_sublimation_ids.iter().take(8) {
            let mut candidate = input.clone();
            candidate.sublimation_ids = active_sublimation_ids
                .iter()
                .filter(|active_sublimation_id| *active_sublimation_id != sublimation_id)
                .cloned()
                .chain(std::iter::once(replacement_sublimation_id.clone()))
                .collect();
            candidate.sublimation_ids.sort();
            add_elite_neighbor(
                queue,
                candidate,
                seen,
                metrics,
                generated,
                Some("hybridSublimationNeighborCandidates"),
            );
        }
    }
}

fn add_elite_neighbor(
    queue: &mut Vec<OptimizerCandidateInput>,
    candidate: OptimizerCandidateInput,
    seen: &mut BTreeSet<String>,
    metrics: &mut BTreeMap<String, u32>,
    generated: &mut u32,
    metric: Option<&str>,
) -> bool {
    const MAX_QUEUE_SIZE: usize = 1_024;
    const MAX_GENERATED: u32 = 640;
    if queue.len() >= MAX_QUEUE_SIZE || *generated >= MAX_GENERATED {
        return false;
    }

    let normalized = normalize_candidate(candidate);
    let key = encode_candidate(&normalized);
    if seen.contains(&key) {
        return false;
    }

    seen.insert(key);
    queue.push(normalized);
    *generated += 1;
    if let Some(metric) = metric {
        *metrics.entry(metric.to_string()).or_insert(0) += 1;
    }
    true
}

fn get_top_weighted_actions(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    limit: usize,
) -> Vec<CandidateAction> {
    let entries_by_id = catalog
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let mut weighted_actions = get_search_actions(request, catalog)
        .into_iter()
        .map(|action| {
            let weight = entries_by_id
                .get(action.spell_id.as_str())
                .map(|entry| get_action_search_weight(entry))
                .unwrap_or(1.0);
            (action, weight)
        })
        .collect::<Vec<_>>();
    weighted_actions.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    weighted_actions
        .into_iter()
        .take(std::cmp::max(1, limit))
        .map(|(action, _)| action)
        .collect()
}

fn create_random_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    rng: &mut SeededRandom,
) -> OptimizerCandidateInput {
    OptimizerCandidateInput {
        passive_ids: pick_random_passives(request, catalog, rng),
        sublimation_ids: pick_random_sublimations(request, rng),
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
        sublimation_ids: pick_random_sublimations(request, rng),
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
    element: Option<Element>,
    cost: SpellCost,
    constraints: Vec<Value>,
    effects: Vec<Value>,
    rules: SpellRules,
    damage_effects: Vec<DamageEffect>,
    passive_effects: Vec<PassiveEffect>,
    action_weight: f64,
    passive_weight: f64,
}

fn read_search_catalog(request: &OptimizerRequest) -> Result<Vec<SearchCatalogEntry>, String> {
    let entries = request
        .catalog
        .as_array()
        .ok_or_else(|| "Expected optimizer request catalog to be an array.".to_string())?;

    Ok(entries
        .iter()
        .map(|entry| {
            let id = read_string_field(entry, "id").unwrap_or_default();
            let kind = read_string_field(entry, "kind").unwrap_or_default();
            let element = entry
                .get("element")
                .cloned()
                .and_then(|value| serde_json::from_value::<Element>(value).ok());
            let cost = read_spell_cost(entry.get("cost"));
            let constraints = entry
                .get("constraints")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let effects = entry
                .get("effects")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let tags: Vec<String> = entry
                .get("tags")
                .and_then(Value::as_array)
                .map(|tags| {
                    tags.iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();
            let rules = create_spell_rules_from_parts(&id, element.clone(), &constraints);
            let damage_effects = collect_damage_effects_from_values(&effects);
            let passive_effects = effects
                .iter()
                .filter_map(|effect| serde_json::from_value::<PassiveEffect>(effect.clone()).ok())
                .collect::<Vec<_>>();
            let action_weight = compute_action_search_weight_from_parts(&effects, &tags);
            let passive_weight = compute_passive_search_weight_from_parts(&effects, &tags);

            SearchCatalogEntry {
                id,
                kind,
                element,
                cost,
                constraints,
                effects,
                rules,
                damage_effects,
                passive_effects,
                action_weight,
                passive_weight,
            }
        })
        .collect())
}

fn read_request_resources(character: &Value) -> ResourcePool {
    read_resource_pool(character.get("resources"))
}

fn read_request_stats(character: &Value) -> BaseStats {
    character
        .get("stats")
        .cloned()
        .and_then(|value| serde_json::from_value::<BaseStats>(value).ok())
        .unwrap_or_default()
}

fn read_score_criterion(request: &OptimizerRequest) -> ScoreCriterion {
    let Some(criterion) = request.criterion.as_ref() else {
        return ScoreCriterion::TotalDamage;
    };

    match read_string_field(criterion, "type").as_deref() {
        Some("elementDamage") => criterion
            .get("element")
            .cloned()
            .and_then(|value| serde_json::from_value::<Element>(value).ok())
            .map(|element| ScoreCriterion::TargetElementDamage { element })
            .unwrap_or(ScoreCriterion::TotalDamage),
        Some("targetElementDamage") => serde_json::from_value::<ScoreCriterion>(criterion.clone())
            .unwrap_or(ScoreCriterion::TotalDamage),
        _ => ScoreCriterion::TotalDamage,
    }
}

fn read_request_huppermage(
    character: &Value,
    resources: ResourcePool,
    active_passive_ids: Vec<String>,
) -> HuppermageState {
    let parsed = character
        .get("classState")
        .and_then(|class_state| class_state.get("huppermage"))
        .cloned()
        .and_then(|value| serde_json::from_value::<HuppermageState>(value).ok());
    let mut state = parsed.unwrap_or_else(|| create_huppermage_state(resources, vec![]));
    state.active_passives = active_passive_ids;
    state.bq_max = state.bq_max.max(resources.bq.max(resources.wp * 75.0));
    state
}

fn read_passive_entries_from_catalog(
    catalog: &[SearchCatalogEntry],
    passive_ids: &[String],
) -> Vec<PassiveEntry> {
    catalog
        .iter()
        .filter(|entry| {
            entry.kind == "passive" && passive_ids.iter().any(|passive_id| passive_id == &entry.id)
        })
        .map(|entry| PassiveEntry {
            id: entry.id.clone(),
            effects: entry.passive_effects.clone(),
        })
        .collect()
}

fn read_resource_pool(value: Option<&Value>) -> ResourcePool {
    ResourcePool {
        ap: read_f64_field(value, "ap"),
        mp: read_f64_field(value, "mp"),
        wp: read_f64_field(value, "wp"),
        bq: read_f64_field(value, "bq"),
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

fn create_spell_rules_from_search_entry(spell: &SearchCatalogEntry) -> SpellRules {
    spell.rules.clone()
}

fn create_spell_rules_from_parts(
    id: &str,
    element: Option<Element>,
    constraints: &[Value],
) -> SpellRules {
    SpellRules {
        id: id.to_string(),
        element,
        is_deck_tracked: id != "coeur-de-lumiere"
            && id != "cycle-elementaire"
            && id != "feu-follet",
        max_casts_per_turn: read_constraint_u32(constraints, "maxCastsPerTurn"),
        max_casts_per_target: read_constraint_u32(constraints, "maxCastsPerTarget"),
        cooldown_turns: read_constraint_u32(constraints, "cooldownTurns"),
        required_target: constraints
            .iter()
            .find(|constraint| {
                read_string_field(constraint, "type").as_deref() == Some("requiresTarget")
            })
            .and_then(|constraint| read_action_target_kind(constraint.get("target"))),
    }
}

fn read_constraint_u32(constraints: &[Value], constraint_type: &str) -> Option<u32> {
    constraints
        .iter()
        .find(|constraint| {
            read_string_field(constraint, "type").as_deref() == Some(constraint_type)
        })
        .map(|constraint| read_u32_field(Some(constraint), "value"))
}

fn collect_search_damage_effects(spell: &SearchCatalogEntry) -> &[DamageEffect] {
    &spell.damage_effects
}

fn collect_damage_effects_from_values(effects: &[Value]) -> Vec<DamageEffect> {
    effects
        .iter()
        .filter_map(|effect| {
            if read_string_field(effect, "type").as_deref() == Some("damage") {
                serde_json::from_value::<DamageEffect>(effect.clone()).ok()
            } else {
                None
            }
        })
        .collect()
}

fn resolve_search_effective_cost(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
    casts_by_spell_id: &BTreeMap<String, u32>,
) -> SpellCost {
    let mut cost = spell.cost;

    for value in collect_search_tag_values(&spell.effects, "costDelta", state, action) {
        let Some(delta) = value.as_str() else {
            continue;
        };
        let Some((resource, amount)) = delta.split_once(':') else {
            continue;
        };
        let Ok(amount) = amount.parse::<i32>() else {
            continue;
        };
        add_spell_cost_resource(&mut cost, resource, amount);
    }

    for tag_name in ["additionalBqCostPerRune", "dynamicBqCostPerRune"] {
        for value in collect_search_tag_values(&spell.effects, tag_name, state, action) {
            let amount = value
                .as_i64()
                .map(|value| value as i32)
                .or_else(|| value.as_f64().map(|value| value.round() as i32))
                .unwrap_or(0);
            cost.bq += amount * get_active_rune_count(state) as i32;
        }
    }

    for value in collect_search_tag_values(
        &spell.effects,
        "increasingBqCostPerUseThisTurn",
        state,
        action,
    ) {
        let amount = value
            .as_i64()
            .map(|value| value as i32)
            .or_else(|| value.as_f64().map(|value| value.round() as i32))
            .unwrap_or(0);
        cost.bq += amount * casts_by_spell_id.get(&spell.id).copied().unwrap_or(0) as i32;
    }

    cost.ap = cost.ap.max(0);
    cost.mp = cost.mp.max(0);
    cost.wp = cost.wp.max(0);
    cost.bq = cost.bq.max(0);

    cost
}

fn add_spell_cost_resource(cost: &mut SpellCost, resource: &str, amount: i32) {
    match resource {
        "ap" => cost.ap += amount,
        "mp" => cost.mp += amount,
        "wp" => cost.wp += amount,
        "bq" => cost.bq += amount,
        _ => {}
    }
}

fn collect_search_damage_inflicted_bonus_percent(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
    resources: ResourcePool,
) -> f64 {
    collect_search_tag_values(
        &spell.effects,
        "damageInflictedPercentPerBqPercentRemaining",
        state,
        action,
    )
    .into_iter()
    .filter_map(|value| value.as_f64())
    .fold(0.0, |total, value| {
        let bq_percent_remaining = if state.bq_max > 0.0 {
            (resources.bq.max(0.0) / state.bq_max) * 100.0
        } else {
            0.0
        };
        round_damage(total + value * bq_percent_remaining)
    })
}

fn collect_search_consumed_runes(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
) -> Vec<Rune> {
    let mut runes = collect_search_tag_values(&spell.effects, "consumeRune", state, action)
        .into_iter()
        .filter_map(|value| serde_json::from_value::<Rune>(value.clone()).ok())
        .collect::<Vec<_>>();
    if collect_search_tag_values(&spell.effects, "consumeAllRunes", state, action)
        .into_iter()
        .any(|value| value.as_bool() == Some(true))
        || collect_search_tag_values(&spell.effects, "consumesRunes", state, action)
            .into_iter()
            .any(|value| value.as_bool() == Some(true))
    {
        runes.extend(
            rune_application_order()
                .into_iter()
                .filter(|rune| is_rune_active(&state.runes.active, rune)),
        );
    }
    sort_runes_for_application(&runes)
}

fn apply_halo_chatoyant_damage(
    spell: &SearchCatalogEntry,
    state: &mut HuppermageState,
    action: &CandidateAction,
) -> Option<DamageEffect> {
    if spell.id != "halo-chatoyant" {
        return None;
    }

    let triggered_existing_marks = u32::from(state.halo_chatoyant_marks > 0);
    let triggers_current_mark =
        collect_search_tag_values(&spell.effects, "triggerMarkImmediately", state, action)
            .into_iter()
            .any(|value| value.as_bool() == Some(true));
    let trigger_count = triggered_existing_marks + u32::from(triggers_current_mark);
    state.halo_chatoyant_marks = if triggers_current_mark { 0 } else { 1 };

    if trigger_count == 0 {
        return None;
    }

    Some(DamageEffect {
        element: Element::Light,
        base: 81.0,
        times: Some(trigger_count as f64),
    })
}

fn collect_search_delayed_damage(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
    action_damage: f64,
) -> Vec<(Element, f64)> {
    if action_damage <= 0.0 {
        return vec![];
    }

    let element = state
        .runes
        .last_generated_rune
        .as_ref()
        .map(rune_to_element)
        .or_else(|| spell.element.clone())
        .unwrap_or(Element::Light);

    collect_search_tag_values(
        &spell.effects,
        "delayedDamagePercentOfActionDamage",
        state,
        action,
    )
    .into_iter()
    .filter_map(|value| value.as_f64())
    .map(|percent| {
        (
            element.clone(),
            round_damage(action_damage * percent / 100.0),
        )
    })
    .filter(|(_, amount)| *amount > 0.0)
    .collect()
}

fn count_search_removal_events(
    effects: &[Value],
    state: &HuppermageState,
    action: &CandidateAction,
) -> i32 {
    let mut count = 0;
    for effect in effects {
        match read_string_field(effect, "type").as_deref() {
            Some("resourceDelta")
                if read_string_field(effect, "target").as_deref() == Some("target")
                    && read_i32_field(Some(effect), "amount") < 0
                    && matches!(
                        read_string_field(effect, "resource").as_deref(),
                        Some("ap") | Some("mp")
                    ) =>
            {
                count += 1;
            }
            Some("statModifier")
                if read_string_field(effect, "target").as_deref() == Some("target")
                    && read_string_field(effect, "stat").as_deref() == Some("range")
                    && read_f64_field(Some(effect), "amount") < 0.0 =>
            {
                count += 1;
            }
            Some("conditional")
                if is_search_condition_met(effect.get("condition"), state, action) =>
            {
                if let Some(nested) = effect.get("effects").and_then(Value::as_array) {
                    count += count_search_removal_events(nested, state, action);
                }
            }
            _ => {}
        }
    }

    count
}

fn count_search_movement_events(effects: &[Value], state: &HuppermageState) -> i32 {
    let mut count = 0;
    for effect in effects {
        match read_string_field(effect, "type").as_deref() {
            Some("movement") => count += 1,
            Some("conditional")
                if is_search_condition_met(
                    effect.get("condition"),
                    state,
                    &CandidateAction {
                        spell_id: String::new(),
                        target: None,
                        context: None,
                    },
                ) =>
            {
                if let Some(nested) = effect.get("effects").and_then(Value::as_array) {
                    count += count_search_movement_events(nested, state);
                }
            }
            Some("trigger") => {
                if let Some(nested) = effect.get("effects").and_then(Value::as_array) {
                    count += count_search_movement_events(nested, state);
                }
            }
            _ => {}
        }
    }

    count
}

fn apply_absorption_quadramentale_bq_gain(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
    resources: &mut ResourcePool,
) {
    if !has_passive(state, "absorption-quadramentale") {
        return;
    }

    let trigger_count = count_search_removal_events(&spell.effects, state, action);
    if trigger_count > 0 {
        resources.bq += f64::from(apply_bq_gain_multiplier(trigger_count * 20, state));
    }
}

fn apply_extension_des_sens_bq_regeneration(
    spell: &SearchCatalogEntry,
    effective_cost: SpellCost,
    state: &mut HuppermageState,
    resources: &mut ResourcePool,
) {
    if !has_passive(state, "extension-des-sens") {
        return;
    }

    let Some(heart) = state.active_heart.clone() else {
        return;
    };

    let ap_cost = effective_cost.ap.max(0);
    let mut water_heart_last_spell_kind = state.water_heart_last_spell_kind.clone();
    let trigger_count = match heart {
        HuppermageHeart::Fire => {
            if spell
                .element
                .as_ref()
                .is_some_and(|element| is_elemental_spell_element(element))
            {
                1
            } else {
                0
            }
        }
        HuppermageHeart::Earth => i32::from(ap_cost > 0),
        HuppermageHeart::Air => count_search_movement_events(&spell.effects, state),
        HuppermageHeart::Water => {
            let current_spell_kind = get_water_heart_spell_kind(spell.element.as_ref());
            let triggers = current_spell_kind.is_some()
                && water_heart_last_spell_kind.is_some()
                && current_spell_kind != water_heart_last_spell_kind;
            water_heart_last_spell_kind = current_spell_kind;
            i32::from(triggers)
        }
    };
    state.water_heart_last_spell_kind = water_heart_last_spell_kind;

    let amount = trigger_count * ap_cost * 20;
    if amount > 0 {
        resources.bq += f64::from(apply_bq_gain_multiplier(amount, state));
    }
}

fn get_water_heart_spell_kind(element: Option<&Element>) -> Option<HuppermageWaterHeartSpellKind> {
    match element {
        Some(Element::Light) => Some(HuppermageWaterHeartSpellKind::Light),
        Some(element) if is_elemental_spell_element(element) => {
            Some(HuppermageWaterHeartSpellKind::Elemental)
        }
        _ => None,
    }
}

fn apply_search_resource_deltas(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
    resources: &mut ResourcePool,
) {
    let deltas = collect_search_effects_by_type(&spell.effects, "resourceDelta", state, action);
    for delta in deltas {
        if read_string_field(&delta, "target").is_some_and(|target| target != "caster") {
            continue;
        }
        let amount = f64::from(read_i32_field(Some(&delta), "amount"));
        if let Some(resource) = read_string_field(&delta, "resource") {
            resources.add_resource(&resource, amount);
        }
    }
}

fn apply_search_stat_modifiers(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    action: &CandidateAction,
    stats: &mut BaseStats,
) {
    let scale_per_rune =
        collect_search_tag_values(&spell.effects, "statModifiersScalePerRune", state, action)
            .into_iter()
            .any(|value| value.as_bool() == Some(true));
    let multiplier = if scale_per_rune {
        get_active_rune_count(state) as f64
    } else {
        1.0
    };

    let modifiers = collect_search_effects_by_type(&spell.effects, "statModifier", state, action);
    for modifier in modifiers {
        if read_string_field(&modifier, "target").is_some_and(|target| target != "caster") {
            continue;
        }
        let amount = read_f64_field(Some(&modifier), "amount") * multiplier;
        match read_string_field(&modifier, "stat").as_deref() {
            Some("damageInflictedPercent") => stats.damage_inflicted_percent += amount,
            Some("healsPerformedPercent") => stats.heals_performed_percent += amount,
            Some("range") => stats.range += amount,
            Some("willpower") => stats.willpower += amount,
            Some("criticalHitPercent") => stats.critical_hit_percent += amount,
            Some("elementalResistance") => stats.elemental_resistance += amount,
            Some("parry") => stats.parry += amount,
            _ => {}
        }
    }
}

fn apply_passive_spell_stat_modifiers(
    spell: &SearchCatalogEntry,
    state: &HuppermageState,
    stats: &mut BaseStats,
) {
    if spell
        .element
        .as_ref()
        .is_some_and(|element| is_elemental_spell_element(element))
        && has_passive(state, "antithese")
    {
        stats.damage_inflicted_percent -= 10.0;
    }

    if spell.element == Some(Element::Light) && has_passive(state, "absorption-quadramentale") {
        stats.damage_inflicted_percent -= 10.0;
    }
}

fn is_elemental_spell_element(element: &Element) -> bool {
    matches!(
        element,
        Element::Fire | Element::Water | Element::Earth | Element::Air
    )
}

fn collect_search_effects_by_type<'a>(
    effects: &'a [Value],
    effect_type: &str,
    state: &HuppermageState,
    action: &CandidateAction,
) -> Vec<&'a Value> {
    let mut values = vec![];
    for effect in effects {
        match read_string_field(effect, "type").as_deref() {
            Some(current_type) if current_type == effect_type => values.push(effect),
            Some("conditional") => {
                if is_search_condition_met(effect.get("condition"), state, action) {
                    let nested_values = effect
                        .get("effects")
                        .and_then(Value::as_array)
                        .map(|nested| {
                            collect_search_effects_by_type(nested, effect_type, state, action)
                        })
                        .unwrap_or_default();
                    values.extend(nested_values);
                }
            }
            _ => {}
        }
    }
    values
}

fn collect_search_tag_values<'a>(
    effects: &'a [Value],
    tag_name: &str,
    state: &HuppermageState,
    action: &CandidateAction,
) -> Vec<&'a Value> {
    let mut values = vec![];
    for effect in effects {
        match read_string_field(effect, "type").as_deref() {
            Some("tag") if read_string_field(effect, "tag").as_deref() == Some(tag_name) => {
                if let Some(value) = effect.get("value") {
                    values.push(value);
                }
            }
            Some("conditional") => {
                if is_search_condition_met(effect.get("condition"), state, action) {
                    let nested_values = effect
                        .get("effects")
                        .and_then(Value::as_array)
                        .map(|nested| collect_search_tag_values(nested, tag_name, state, action))
                        .unwrap_or_default();
                    values.extend(nested_values);
                }
            }
            _ => {}
        }
    }
    values
}

fn is_search_condition_met(
    condition: Option<&Value>,
    state: &HuppermageState,
    action: &CandidateAction,
) -> bool {
    match condition
        .and_then(|value| read_string_field(value, "type"))
        .as_deref()
    {
        Some("hasRune") => condition
            .and_then(|value| value.get("rune"))
            .cloned()
            .and_then(|value| serde_json::from_value::<Rune>(value).ok())
            .is_some_and(|rune| is_rune_active(&state.runes.active, &rune)),
        Some("lastRune") => condition
            .and_then(|value| value.get("rune"))
            .cloned()
            .and_then(|value| serde_json::from_value::<Rune>(value).ok())
            .is_some_and(|rune| state.runes.last_generated_rune.as_ref() == Some(&rune)),
        Some("exactRuneCount") => {
            let count = read_u32_field(condition, "count") as usize;
            get_active_rune_count(state) == count
        }
        Some("targetIs") => condition
            .and_then(|value| read_string_field(value, "value"))
            .is_some_and(|expected| {
                action
                    .target
                    .as_ref()
                    .map(|target| action_target_kind_key(&target.kind))
                    == Some(expected.as_str())
            }),
        _ => false,
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
            context: None,
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
                context: None,
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

fn pick_random_sublimations(request: &OptimizerRequest, rng: &mut SeededRandom) -> Vec<String> {
    let sublimation_ids = get_available_sublimation_ids(request);
    if sublimation_ids.is_empty() || request.max_sublimation_count == 0 {
        return Vec::new();
    }

    let sublimation_limit = std::cmp::min(
        request.max_sublimation_count as usize,
        sublimation_ids.len(),
    );
    let target_count = if request.iterations >= 80 {
        rng.integer(
            std::cmp::min(1, sublimation_limit) as u32,
            sublimation_limit as u32,
        ) as usize
    } else {
        rng.integer(0, sublimation_limit as u32) as usize
    };
    let mut remaining = sublimation_ids;
    let mut selected = Vec::new();
    for _index in 0..target_count {
        let sublimation_id = pick_weighted_sublimation_id(&remaining, rng);
        selected.push(sublimation_id.clone());
        remaining.retain(|entry| entry != &sublimation_id);
    }
    selected.sort();
    selected
}

fn pick_domain_seed_sublimations(request: &OptimizerRequest) -> Vec<String> {
    let available = get_available_sublimation_ids(request)
        .into_iter()
        .collect::<BTreeSet<_>>();
    let mut selected = [
        "influence-6",
        "carnage-6",
        "brulure-4",
        "gel-4",
        "tellurisme-4",
        "ventilation-4",
        "puissance-brute-4",
        "alternance-ii",
        "exces-ii",
        "longueur-6",
        "concentration-elementaire",
        "armure-lourde-2",
    ]
    .into_iter()
    .filter(|sublimation_id| available.contains(*sublimation_id))
    .take(request.max_sublimation_count as usize)
    .map(str::to_string)
    .collect::<Vec<_>>();
    selected.sort();
    selected
}

fn get_available_sublimation_ids(request: &OptimizerRequest) -> Vec<String> {
    let mut sublimation_ids = request
        .available_sublimation_ids
        .iter()
        .filter(|sublimation_id| is_supported_sublimation_id(sublimation_id))
        .cloned()
        .collect::<Vec<_>>();
    sublimation_ids.sort_by(|left, right| {
        get_sublimation_search_weight(right)
            .partial_cmp(&get_sublimation_search_weight(left))
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.cmp(right))
    });
    sublimation_ids.dedup();
    sublimation_ids
}

fn pick_weighted_sublimation_id(sublimation_ids: &[String], rng: &mut SeededRandom) -> String {
    let total_weight = sublimation_ids
        .iter()
        .map(|sublimation_id| get_sublimation_search_weight(sublimation_id))
        .sum::<f64>()
        .max(1.0);
    let mut cursor = rng.next() * total_weight;
    for sublimation_id in sublimation_ids {
        cursor -= get_sublimation_search_weight(sublimation_id);
        if cursor <= 0.0 {
            return sublimation_id.clone();
        }
    }
    sublimation_ids.last().cloned().unwrap_or_default()
}

fn is_supported_sublimation_id(sublimation_id: &str) -> bool {
    sublimation_family_id(sublimation_id).is_some()
}

fn get_sublimation_search_weight(sublimation_id: &str) -> f64 {
    match sublimation_family_id(sublimation_id).unwrap_or("") {
        "puissance-brute" | "alternance" | "exces" => 10.0,
        "concentration-elementaire" | "chaos" => 9.0,
        "carnage" | "armure-lourde" => 8.0,
        "influence" | "influence-vitale" | "critique-berserk" => 6.0,
        "brulure" | "gel" | "tellurisme" | "ventilation" => 5.0,
        "brulure-secondaire"
        | "gel-secondaire"
        | "tellurisme-secondaire"
        | "ventilation-secondaire" => 4.5,
        "longueur" => 4.0,
        "sauvegarde" | "tolerance" => 3.0,
        "force-vitale" | "agilite-vitale" | "vivacite" | "velocite" => 2.0,
        _ => 1.0,
    }
}

fn validate_candidate_sublimations(candidate: &OptimizerCandidateInput) -> Option<String> {
    if let Some(unknown_sublimation_id) = candidate
        .sublimation_ids
        .iter()
        .find(|sublimation_id| !is_supported_sublimation_id(sublimation_id))
        .cloned()
    {
        return Some(unknown_sublimation_id);
    }

    let normal_count = candidate
        .sublimation_ids
        .iter()
        .filter(|sublimation_id| get_sublimation_category(sublimation_id) == Some("normal"))
        .count();
    let epic_count = candidate
        .sublimation_ids
        .iter()
        .filter(|sublimation_id| get_sublimation_category(sublimation_id) == Some("epic"))
        .count();
    let relic_count = candidate
        .sublimation_ids
        .iter()
        .filter(|sublimation_id| get_sublimation_category(sublimation_id) == Some("relic"))
        .count();
    if normal_count > 10 || epic_count > 1 || relic_count > 1 {
        return Some("slotLimitExceeded".to_string());
    }

    None
}

fn apply_initial_sublimations(
    candidate: &OptimizerCandidateInput,
    character: &Value,
    stats: &mut BaseStats,
    resources: &mut ResourcePool,
) {
    let hp_assumption = character
        .get("sublimations")
        .and_then(|sublimations| sublimations.get("hpAssumption"))
        .and_then(Value::as_str)
        .unwrap_or("normal");
    let condition_stats = stats.clone();
    let condition_resources = *resources;

    for family_id in collect_candidate_sublimation_families(candidate) {
        if !is_sublimation_hp_requirement_satisfied(family_id, hp_assumption) {
            continue;
        }
        let level = get_candidate_sublimation_family_level(candidate, family_id);
        match family_id {
            "vivacite" => {
                resources.ap += 0.5 * level;
                stats.elemental_resistance -= 37.5 * level;
            }
            "velocite" => {
                resources.mp += 0.5 * level;
                stats.damage_inflicted_percent -= 5.0 * level;
            }
            "devastation" => {
                resources.wp += (1.0 / 3.0) * level;
                stats.willpower -= (10.0 / 3.0) * level;
            }
            "influence" => stats.critical_hit_percent += 3.0 * level,
            "influence-vitale" => stats.critical_hit_percent += 4.0 * level,
            "critique-berserk" => stats.critical_hit_percent += 5.0 * level,
            "force-vitale" => resources.ap += 0.5 * level,
            "agilite-vitale" => resources.mp += 0.5 * level,
            "armure-lourde" => {
                resources.mp += -0.5 * level;
                stats.damage_inflicted_percent += 5.0 * level;
            }
            "carnage" => stats.general_mastery += 90.0 * level,
            "puissance-brute" => resources.wp -= level,
            "concentration-elementaire" => {
                stats.damage_inflicted_percent += 20.0;
                stats.heals_performed_percent += 20.0;
                apply_weakest_elemental_mastery_percent(stats, 3, -30.0);
            }
            "chaos" => {
                stats.damage_inflicted_percent += 20.0;
                stats.heals_performed_percent += 20.0;
                apply_weakest_elemental_mastery_percent(stats, 4, -100.0);
            }
            "secret-critique" if condition_stats.critical_mastery <= 0.0 => {
                stats.critical_hit_percent += 30.0;
            }
            "exces" => stats.damage_inflicted_percent -= 10.0,
            "expert-des-armes-legeres" => stats.general_mastery += 150.0 * level,
            _ => {}
        }
    }
    if candidate
        .sublimation_ids
        .iter()
        .any(|sublimation_id| sublimation_id == "inflexibilite")
        && condition_resources.ap <= 10.0
    {
        stats.damage_inflicted_percent += 15.0;
        stats.willpower += 10.0;
    }
    if candidate
        .sublimation_ids
        .iter()
        .any(|sublimation_id| sublimation_id == "inflexibilite-ii")
        && has_no_secondary_mastery(&condition_stats)
    {
        stats.damage_inflicted_percent += 20.0;
        stats.heals_performed_percent += 20.0;
    }
}

fn apply_weakest_elemental_mastery_percent(stats: &mut BaseStats, count: usize, percent: f64) {
    let mut entries = vec![
        (Element::Fire, stats.elemental_mastery.fire),
        (Element::Water, stats.elemental_mastery.water),
        (Element::Earth, stats.elemental_mastery.earth),
        (Element::Air, stats.elemental_mastery.air),
    ];
    entries.sort_by(|left, right| {
        left.1
            .partial_cmp(&right.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.0.cmp(&right.0))
    });
    for (element, mastery) in entries.into_iter().take(count) {
        let next = round_damage(mastery + mastery * percent / 100.0);
        set_elemental_mastery(&mut stats.elemental_mastery, &element, next);
    }
}

fn set_elemental_mastery(mastery: &mut ElementalMastery, element: &Element, value: f64) {
    match element {
        Element::Fire => mastery.fire = value,
        Element::Water => mastery.water = value,
        Element::Earth => mastery.earth = value,
        Element::Air => mastery.air = value,
        Element::Light => mastery.light = value,
        Element::Neutral => mastery.neutral = value,
    }
}

fn has_no_secondary_mastery(stats: &BaseStats) -> bool {
    stats.melee_mastery <= 0.0
        && stats.distance_mastery <= 0.0
        && stats.berserk_mastery <= 0.0
        && stats.rear_mastery <= 0.0
        && stats.critical_mastery <= 0.0
}

#[derive(Clone, Copy)]
struct SupportedSublimationDefinition {
    id: &'static str,
    family_id: &'static str,
    category: &'static str,
    effective_level: f64,
    cumulative_max: f64,
    hp_requirement: SublimationHpRequirement,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SublimationHpRequirement {
    Any,
    Min90,
    Max50,
}

const fn supported_sublimation(
    id: &'static str,
    family_id: &'static str,
    category: &'static str,
    effective_level: f64,
    cumulative_max: f64,
    hp_requirement: SublimationHpRequirement,
) -> SupportedSublimationDefinition {
    SupportedSublimationDefinition {
        id,
        family_id,
        category,
        effective_level,
        cumulative_max,
        hp_requirement,
    }
}

const SUPPORTED_SUBLIMATIONS: &[SupportedSublimationDefinition] = &[
    supported_sublimation(
        "agilite-vitale-ii",
        "agilite-vitale",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "agilite-vitale-2",
        "agilite-vitale",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "alternance",
        "alternance",
        "relic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "alternance-ii",
        "alternance",
        "relic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "armure-lourde-i",
        "armure-lourde",
        "normal",
        1.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "armure-lourde-ii",
        "armure-lourde",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "armure-lourde-2",
        "armure-lourde",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-i",
        "brulure",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-ii",
        "brulure",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-iii",
        "brulure",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-4",
        "brulure",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-secondaire-i",
        "brulure-secondaire",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-secondaire-ii",
        "brulure-secondaire",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-secondaire-iii",
        "brulure-secondaire",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "brulure-secondaire-4",
        "brulure-secondaire",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "carnage-i",
        "carnage",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "carnage-ii",
        "carnage",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "carnage-iii",
        "carnage",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "carnage-6",
        "carnage",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "chaos",
        "chaos",
        "epic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "cicatrisation-i",
        "cicatrisation",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "cicatrisation-ii",
        "cicatrisation",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "cicatrisation-iii",
        "cicatrisation",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "cicatrisation-6",
        "cicatrisation",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "concentration-elementaire",
        "concentration-elementaire",
        "epic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "critique-berserk-i",
        "critique-berserk",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Max50,
    ),
    supported_sublimation(
        "critique-berserk-ii",
        "critique-berserk",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Max50,
    ),
    supported_sublimation(
        "critique-berserk-iii",
        "critique-berserk",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Max50,
    ),
    supported_sublimation(
        "critique-berserk-6",
        "critique-berserk",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Max50,
    ),
    supported_sublimation(
        "devastation-i",
        "devastation",
        "normal",
        1.0,
        3.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "devastation-ii",
        "devastation",
        "normal",
        2.0,
        3.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "devastation-iii",
        "devastation",
        "normal",
        3.0,
        3.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "devastation-3",
        "devastation",
        "normal",
        3.0,
        3.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "exces",
        "exces",
        "relic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "exces-ii",
        "exces",
        "relic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "expert-des-armes-legeres-i",
        "expert-des-armes-legeres",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "expert-des-armes-legeres-ii",
        "expert-des-armes-legeres",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "expert-des-armes-legeres-iii",
        "expert-des-armes-legeres",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "expert-des-armes-legeres-6",
        "expert-des-armes-legeres",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "force-vitale-ii",
        "force-vitale",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "force-vitale-2",
        "force-vitale",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "gel-i",
        "gel",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-ii",
        "gel",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-iii",
        "gel",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-4",
        "gel",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-secondaire-i",
        "gel-secondaire",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-secondaire-ii",
        "gel-secondaire",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-secondaire-iii",
        "gel-secondaire",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "gel-secondaire-4",
        "gel-secondaire",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "inflexibilite",
        "inflexibilite",
        "epic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "inflexibilite-ii",
        "inflexibilite",
        "epic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "influence-i",
        "influence",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "influence-ii",
        "influence",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "influence-iii",
        "influence",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "influence-6",
        "influence",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "influence-vitale-i",
        "influence-vitale",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "influence-vitale-ii",
        "influence-vitale",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "influence-vitale-iii",
        "influence-vitale",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "influence-vitale-6",
        "influence-vitale",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Min90,
    ),
    supported_sublimation(
        "longueur-i",
        "longueur",
        "normal",
        1.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "longueur-ii",
        "longueur",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "longueur-iii",
        "longueur",
        "normal",
        3.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "longueur-6",
        "longueur",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "puissance-brute-i",
        "puissance-brute",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "puissance-brute-ii",
        "puissance-brute",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "puissance-brute-iii",
        "puissance-brute",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "puissance-brute-4",
        "puissance-brute",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "sauvegarde-ii",
        "sauvegarde",
        "normal",
        2.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "sauvegarde-6",
        "sauvegarde",
        "normal",
        6.0,
        6.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "secret-critique",
        "secret-critique",
        "epic",
        1.0,
        1.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-i",
        "tellurisme",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-ii",
        "tellurisme",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-iii",
        "tellurisme",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-4",
        "tellurisme",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-secondaire-i",
        "tellurisme-secondaire",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-secondaire-ii",
        "tellurisme-secondaire",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-secondaire-iii",
        "tellurisme-secondaire",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tellurisme-secondaire-4",
        "tellurisme-secondaire",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tolerance-i",
        "tolerance",
        "normal",
        1.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tolerance-ii",
        "tolerance",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "tolerance-2",
        "tolerance",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "velocite-ii",
        "velocite",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "velocite-2",
        "velocite",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-i",
        "ventilation",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-ii",
        "ventilation",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-iii",
        "ventilation",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-4",
        "ventilation",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-secondaire-i",
        "ventilation-secondaire",
        "normal",
        1.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-secondaire-ii",
        "ventilation-secondaire",
        "normal",
        2.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-secondaire-iii",
        "ventilation-secondaire",
        "normal",
        3.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "ventilation-secondaire-4",
        "ventilation-secondaire",
        "normal",
        4.0,
        4.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "vivacite-ii",
        "vivacite",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
    supported_sublimation(
        "vivacite-2",
        "vivacite",
        "normal",
        2.0,
        2.0,
        SublimationHpRequirement::Any,
    ),
];

fn find_supported_sublimation(
    sublimation_id: &str,
) -> Option<&'static SupportedSublimationDefinition> {
    SUPPORTED_SUBLIMATIONS
        .iter()
        .find(|definition| definition.id == sublimation_id)
}

fn get_sublimation_family_requirement(family_id: &str) -> SublimationHpRequirement {
    SUPPORTED_SUBLIMATIONS
        .iter()
        .find(|definition| definition.family_id == family_id)
        .map(|definition| definition.hp_requirement)
        .unwrap_or(SublimationHpRequirement::Any)
}

fn collect_candidate_sublimation_families(
    candidate: &OptimizerCandidateInput,
) -> Vec<&'static str> {
    let mut families = candidate
        .sublimation_ids
        .iter()
        .filter_map(|sublimation_id| sublimation_family_id(sublimation_id))
        .collect::<Vec<_>>();
    families.sort_unstable();
    families.dedup();
    families
}

fn is_sublimation_hp_requirement_satisfied(family_id: &str, hp_assumption: &str) -> bool {
    match get_sublimation_family_requirement(family_id) {
        SublimationHpRequirement::Any => true,
        SublimationHpRequirement::Min90 => hp_assumption == "healthy90",
        SublimationHpRequirement::Max50 => {
            hp_assumption == "normal"
                || hp_assumption == "berserk50"
                || hp_assumption == "berserk20"
        }
    }
}

fn get_candidate_sublimation_family_level(
    candidate: &OptimizerCandidateInput,
    family_id: &str,
) -> f64 {
    let raw_level = candidate
        .sublimation_ids
        .iter()
        .filter(|sublimation_id| sublimation_family_id(sublimation_id) == Some(family_id))
        .map(|sublimation_id| get_sublimation_effective_level(sublimation_id))
        .sum::<f64>();
    raw_level.min(get_sublimation_cumulative_max(family_id))
}

fn candidate_has_sublimation_family(candidate: &OptimizerCandidateInput, family_id: &str) -> bool {
    candidate
        .sublimation_ids
        .iter()
        .any(|sublimation_id| sublimation_family_id(sublimation_id) == Some(family_id))
}

fn sublimation_family_id(sublimation_id: &str) -> Option<&'static str> {
    find_supported_sublimation(sublimation_id).map(|definition| definition.family_id)
}

fn get_sublimation_category(sublimation_id: &str) -> Option<&'static str> {
    find_supported_sublimation(sublimation_id).map(|definition| definition.category)
}

fn get_sublimation_cumulative_max(family_id: &str) -> f64 {
    SUPPORTED_SUBLIMATIONS
        .iter()
        .filter(|definition| definition.family_id == family_id)
        .map(|definition| definition.cumulative_max)
        .fold(1.0, f64::max)
}

fn get_sublimation_effective_level(sublimation_id: &str) -> f64 {
    find_supported_sublimation(sublimation_id)
        .map(|definition| definition.effective_level)
        .unwrap_or(1.0)
}

fn create_sublimation_combat_state(character: &Value) -> SublimationCombatState {
    let elemental_carryover = character
        .get("sublimationElementalCarryover")
        .and_then(Value::as_object)
        .map(|carryover| {
            carryover
                .iter()
                .filter_map(|(key, value)| {
                    read_element_key(key).map(|element| (element, value.as_f64().unwrap_or(0.0)))
                })
                .collect::<BTreeMap<_, _>>()
        })
        .unwrap_or_default();
    let alternance_previous_element = character
        .get("sublimationAlternancePreviousElement")
        .and_then(|value| serde_json::from_value::<Element>(value.clone()).ok());

    SublimationCombatState {
        elemental_carryover,
        alternance_previous_element,
        ..SublimationCombatState::default()
    }
}

fn read_element_key(key: &str) -> Option<Element> {
    match key {
        "fire" => Some(Element::Fire),
        "water" => Some(Element::Water),
        "earth" => Some(Element::Earth),
        "air" => Some(Element::Air),
        "light" => Some(Element::Light),
        "neutral" => Some(Element::Neutral),
        _ => None,
    }
}

fn add_spent_resources_for_sublimations(state: &mut SublimationCombatState, cost: SpellCost) {
    state.spent_resources_this_turn.ap += f64::from(cost.ap.max(0));
    state.spent_resources_this_turn.mp += f64::from(cost.mp.max(0));
    state.spent_resources_this_turn.wp += f64::from(cost.wp.max(0));
    state.spent_resources_this_turn.bq += f64::from(i32::from(cost.bq > 0));
}

fn collect_sublimation_damage_bonus_percent(
    candidate: &OptimizerCandidateInput,
    spell: &SearchCatalogEntry,
    effective_cost: SpellCost,
    state: &mut SublimationCombatState,
) -> f64 {
    let mut bonus = collect_action_sublimation_bonus(candidate, spell);
    if let Some(damage_element) = spell.element.clone().filter(is_sublimation_element) {
        bonus += consume_elemental_carryover_bonus(candidate, &damage_element, state);
        bonus += collect_alternance_bonus(candidate, &damage_element, state);
    }
    bonus += consume_spell_count_carryover_bonus(candidate, state);
    bonus += collect_spent_resource_sublimation_bonus(candidate, state);

    if effective_cost.ap > 0 {
        store_spell_count_carryover(candidate, state);
    }

    bonus
}

fn collect_action_sublimation_bonus(
    candidate: &OptimizerCandidateInput,
    spell: &SearchCatalogEntry,
) -> f64 {
    let mut bonus = 0.0;
    for family_id in collect_candidate_sublimation_families(candidate) {
        bonus += match (family_id, &spell.element) {
            ("brulure", Some(Element::Fire))
            | ("gel", Some(Element::Water))
            | ("tellurisme", Some(Element::Earth))
            | ("ventilation", Some(Element::Air)) => {
                4.0 * get_candidate_sublimation_family_level(candidate, family_id)
            }
            ("longueur", _) if spell_supports_distance(spell) => {
                2.0 * get_candidate_sublimation_family_level(candidate, family_id)
            }
            _ => 0.0,
        };
    }
    bonus
}

fn consume_elemental_carryover_bonus(
    candidate: &OptimizerCandidateInput,
    damage_element: &Element,
    state: &mut SublimationCombatState,
) -> f64 {
    let has_matching_sublimation = candidate.sublimation_ids.iter().any(|sublimation_id| {
        secondary_carryover_target(sublimation_id).as_ref() == Some(damage_element)
    });
    if !has_matching_sublimation {
        return 0.0;
    }
    state
        .elemental_carryover
        .remove(damage_element)
        .unwrap_or(0.0)
}

fn collect_alternance_bonus(
    candidate: &OptimizerCandidateInput,
    damage_element: &Element,
    state: &SublimationCombatState,
) -> f64 {
    let mut bonus = 0.0;
    if candidate
        .sublimation_ids
        .iter()
        .any(|sublimation_id| sublimation_id == "alternance")
        && state.damage_elements_this_turn.len() == 1
        && state.damage_elements_this_turn.first() != Some(damage_element)
    {
        bonus += 20.0;
    }
    if candidate
        .sublimation_ids
        .iter()
        .any(|sublimation_id| sublimation_id == "alternance-ii")
        && state
            .alternance_previous_element
            .as_ref()
            .is_some_and(|previous| previous != damage_element)
    {
        bonus += 15.0;
    }
    bonus
}

fn consume_spell_count_carryover_bonus(
    candidate: &OptimizerCandidateInput,
    state: &mut SublimationCombatState,
) -> f64 {
    let mut bonus = 0.0;
    for family_id in ["exces", "exces-ii"] {
        if !candidate
            .sublimation_ids
            .iter()
            .any(|sublimation_id| sublimation_family_id(sublimation_id) == Some(family_id))
        {
            continue;
        }
        let entry = state
            .spell_count_carryover
            .entry(family_id.to_string())
            .or_default();
        bonus += entry.pending_damage_inflicted_percent;
        entry.pending_damage_inflicted_percent = 0.0;
    }
    bonus
}

fn collect_spent_resource_sublimation_bonus(
    candidate: &OptimizerCandidateInput,
    state: &SublimationCombatState,
) -> f64 {
    if !candidate_has_sublimation_family(candidate, "puissance-brute") {
        return 0.0;
    }
    let level = get_candidate_sublimation_family_level(candidate, "puissance-brute");
    let spent = state.spent_resources_this_turn.wp + state.spent_resources_this_turn.bq;
    (spent.max(0.0) * 2.0 * level).min(4.0 * level)
}

fn store_sublimation_after_action(
    candidate: &OptimizerCandidateInput,
    spell: &SearchCatalogEntry,
    action_damage: f64,
    state: &mut SublimationCombatState,
) {
    let Some(damage_element) = spell.element.clone().filter(is_sublimation_element) else {
        return;
    };

    for family_id in collect_candidate_sublimation_families(candidate) {
        let Some(target) = secondary_carryover_target(family_id) else {
            continue;
        };
        if !secondary_carryover_triggers(family_id, &damage_element) {
            continue;
        }
        let before = state
            .elemental_carryover
            .get(&target)
            .copied()
            .unwrap_or(0.0);
        let added = 2.0 * get_candidate_sublimation_family_level(candidate, family_id);
        state
            .elemental_carryover
            .insert(target, (before + added).min(30.0));
    }

    if action_damage > 0.0 {
        if !state.damage_elements_this_turn.contains(&damage_element) {
            state.damage_elements_this_turn.push(damage_element.clone());
        }
        state.alternance_previous_element = Some(damage_element);
    }
}

fn store_spell_count_carryover(
    candidate: &OptimizerCandidateInput,
    state: &mut SublimationCombatState,
) {
    for sublimation_id in &candidate.sublimation_ids {
        let (family_id, interval, amount) = match sublimation_id.as_str() {
            "exces" => ("exces", 10, 100.0),
            "exces-ii" => ("exces", 5, 50.0),
            _ => continue,
        };
        let entry = state
            .spell_count_carryover
            .entry(family_id.to_string())
            .or_default();
        entry.qualified_casts += 1;
        if entry.qualified_casts % interval == 0 {
            entry.pending_damage_inflicted_percent =
                entry.pending_damage_inflicted_percent.max(amount);
        }
    }
}

fn secondary_carryover_target(sublimation_id: &str) -> Option<Element> {
    match sublimation_family_id(sublimation_id).unwrap_or(sublimation_id) {
        "brulure-secondaire" => Some(Element::Fire),
        "gel-secondaire" => Some(Element::Water),
        "tellurisme-secondaire" => Some(Element::Earth),
        "ventilation-secondaire" => Some(Element::Air),
        _ => None,
    }
}

fn secondary_carryover_triggers(sublimation_id: &str, element: &Element) -> bool {
    match sublimation_family_id(sublimation_id).unwrap_or(sublimation_id) {
        "brulure-secondaire" => {
            matches!(element, Element::Water | Element::Earth | Element::Air)
        }
        "gel-secondaire" => matches!(element, Element::Fire | Element::Earth | Element::Air),
        "tellurisme-secondaire" => {
            matches!(element, Element::Fire | Element::Water | Element::Air)
        }
        "ventilation-secondaire" => {
            matches!(element, Element::Fire | Element::Water | Element::Earth)
        }
        _ => false,
    }
}

fn is_sublimation_element(element: &Element) -> bool {
    matches!(
        element,
        Element::Fire | Element::Water | Element::Earth | Element::Air
    )
}

fn spell_supports_distance(spell: &SearchCatalogEntry) -> bool {
    spell.element.is_some()
}

fn collect_sublimation_resource_carryover(
    candidate: &OptimizerCandidateInput,
    resources: ResourcePool,
) -> ResourcePool {
    let mut carryover = ResourcePool::default();
    if candidate_has_sublimation_family(candidate, "sauvegarde") && resources.ap > 0.0 {
        let max_amount = 0.5 * get_candidate_sublimation_family_level(candidate, "sauvegarde");
        carryover.ap = resources.ap.min(max_amount);
    }
    if candidate_has_sublimation_family(candidate, "tolerance") && resources.mp > 0.0 {
        let max_amount = get_candidate_sublimation_family_level(candidate, "tolerance");
        carryover.mp = resources.mp.min(max_amount);
    }
    carryover
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

    passive.passive_weight
}

fn compute_passive_search_weight_from_parts(effects: &[Value], tags: &[String]) -> f64 {
    let mut weight = 1.0;
    for effect in effects {
        if read_string_field(effect, "type").as_deref() == Some("statModifier")
            && read_string_field(effect, "stat").as_deref() == Some("damageInflictedPercent")
        {
            let amount = read_f64_field(Some(effect), "amount");
            if amount > 0.0 {
                weight += amount / 5.0;
            }
        }
    }

    for tag in tags {
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
    resources.can_afford(cost)
}

fn apply_soft_action_resources(
    mut resources: ResourcePool,
    spell: &SearchCatalogEntry,
) -> ResourcePool {
    resources.pay_non_negative(spell.cost);

    for effect in &spell.effects {
        if read_string_field(effect, "type").as_deref() == Some("resourceDelta")
            && read_string_field(effect, "target")
                .map(|target| target == "caster")
                .unwrap_or(true)
        {
            let amount = read_i32_field(Some(effect), "amount");
            if let Some(resource) = read_string_field(effect, "resource") {
                resources.add_resource_clamped_min(&resource, f64::from(amount), 0.0);
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
    spell.action_weight
}

fn compute_action_search_weight_from_parts(effects: &[Value], tags: &[String]) -> f64 {
    let mut weight = 1.0;
    for effect in effects {
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

    for tag in tags {
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

fn is_empty_cell_action(action: &CandidateAction) -> bool {
    action
        .target
        .as_ref()
        .is_some_and(|target| target.kind == ActionTargetKind::EmptyCell)
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
        critical_mode: None,
        is_berserk: None,
        is_blocked: None,
    });
    let is_critical = context.is_critical.unwrap_or(false);
    let critical_mode = context.critical_mode.unwrap_or(if is_critical {
        CriticalEvaluationMode::ForcedCritical
    } else {
        CriticalEvaluationMode::ForcedNonCritical
    });

    ActionContext {
        position: context.position.unwrap_or(AttackPosition::Face),
        range_mode: context.range_mode,
        is_critical,
        critical_mode,
        is_berserk: context.is_berserk.unwrap_or(false),
        is_blocked: context.is_blocked.unwrap_or(false),
    }
}

pub fn pay_cost(resources: ResourcePool, cost: SpellCost) -> ResourcePool {
    resources.pay(cost)
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
    let position_multiplier = get_position_multiplier(&resolved_context.position);
    let final_multiplier = 1.0 + stats.damage_inflicted_percent / 100.0;
    let block_multiplier = if resolved_context.is_blocked {
        0.8
    } else {
        1.0
    };
    let times = effect.times.unwrap_or(1.0);
    let non_critical_branch = compute_damage_branch(
        stats,
        effect,
        &resolved_context,
        elemental_mastery,
        false,
        position_multiplier,
        final_multiplier,
        block_multiplier,
        times,
    );
    let critical_branch = compute_damage_branch(
        stats,
        effect,
        &resolved_context,
        elemental_mastery,
        true,
        position_multiplier,
        final_multiplier,
        block_multiplier,
        times,
    );
    let effective_critical_hit_percent = match resolved_context.critical_mode {
        CriticalEvaluationMode::Expected => stats.critical_hit_percent.clamp(0.0, 100.0),
        CriticalEvaluationMode::ForcedCritical => 100.0,
        CriticalEvaluationMode::ForcedNonCritical => 0.0,
    };
    let result = match resolved_context.critical_mode {
        CriticalEvaluationMode::Expected => round_damage(
            non_critical_branch.result * (1.0 - effective_critical_hit_percent / 100.0)
                + critical_branch.result * (effective_critical_hit_percent / 100.0),
        ),
        CriticalEvaluationMode::ForcedCritical => critical_branch.result,
        CriticalEvaluationMode::ForcedNonCritical => non_critical_branch.result,
    };
    let selected_branch =
        if resolved_context.critical_mode == CriticalEvaluationMode::ForcedCritical {
            &critical_branch
        } else {
            &non_critical_branch
        };

    DamageFormulaBreakdown {
        base_damage: effect.base,
        times,
        resolved_element,
        elemental_mastery,
        extra_mastery: selected_branch.extra_mastery,
        mastery_multiplier: selected_branch.mastery_multiplier,
        critical_mode: resolved_context.critical_mode,
        effective_critical_hit_percent,
        non_critical_result: non_critical_branch.result,
        critical_result: critical_branch.result,
        critical_multiplier: selected_branch.critical_multiplier,
        position_multiplier,
        final_multiplier,
        block_multiplier,
        result,
    }
}

struct DamageBranch {
    extra_mastery: f64,
    mastery_multiplier: f64,
    critical_multiplier: f64,
    result: f64,
}

fn compute_damage_branch(
    stats: &BaseStats,
    effect: &DamageEffect,
    context: &ActionContext,
    elemental_mastery: f64,
    is_critical: bool,
    position_multiplier: f64,
    final_multiplier: f64,
    block_multiplier: f64,
    times: f64,
) -> DamageBranch {
    let extra_mastery = get_extra_mastery(stats, context, is_critical);
    let mastery_multiplier =
        1.0 + (stats.general_mastery + elemental_mastery + extra_mastery) / 100.0;
    let critical_multiplier = if is_critical { 1.25 } else { 1.0 };
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

    DamageBranch {
        extra_mastery,
        mastery_multiplier,
        critical_multiplier,
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

fn is_zero_u32(value: &u32) -> bool {
    *value == 0
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
        water_heart_last_spell_kind: None,
        halo_chatoyant_marks: 0,
        bq_max: resources.bq.max(resources.wp * 75.0),
        stored_bq: 0,
        cooldowns_by_spell_id: BTreeMap::new(),
        deck_spell_limit: 12,
        passive_limit: 6,
    }
}

pub fn convert_wp_to_bq(resources: ResourcePool) -> ResourcePool {
    ResourcePool {
        bq: resources.bq + resources.wp * 75.0,
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
        resources.ap += 1.0;
    }

    let antithese_bq_gain = if has_passive(&state, "antithese") {
        apply_bq_gain_multiplier(20, &state)
    } else {
        0
    };
    resources.bq += f64::from(antithese_bq_gain);

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
    let active_rune_count = get_active_rune_count(&state);
    let amount = if state.active_heart.is_some() {
        state.stored_bq += 75;
        0
    } else {
        let gain = apply_bq_gain_multiplier(100 + state.stored_bq, &state);
        resources.bq += f64::from(gain);
        state.stored_bq = 0;
        gain
    };

    if has_passive(&state, "universalite") && active_rune_count > 0 {
        resources.bq -= f64::from((active_rune_count as i32) * 50);
    }

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
        if target.as_ref() != Some(&ActionTargetKind::EmptyCell) {
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
    }

    if spell.max_casts_per_target.is_none() {
        let max_casts_per_turn =
            effective_max_casts_per_turn(spell.max_casts_per_turn, &spell.id, huppermage_state);
        if let Some(max_casts) = max_casts_per_turn {
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

fn effective_max_casts_per_turn(
    max_casts_per_turn: Option<u32>,
    spell_id: &str,
    state: &HuppermageState,
) -> Option<u32> {
    if spell_id == "coeur-de-lumiere" && has_passive(state, "refraction-elementaire") {
        return Some(4);
    }

    max_casts_per_turn
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
    previous_huppermage.water_heart_last_spell_kind = None;
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

fn element_to_rune(element: &Element) -> Option<Rune> {
    match element {
        Element::Fire => Some(Rune::Incandescent),
        Element::Water => Some(Rune::Aquatic),
        Element::Earth => Some(Rune::Telluric),
        Element::Air => Some(Rune::Aerial),
        Element::Light | Element::Neutral => None,
    }
}

fn damage_matches_last_generated_rune(
    stats: &BaseStats,
    effect: &DamageEffect,
    state: &HuppermageState,
) -> bool {
    let Some(last_generated_rune) = state.runes.last_generated_rune.as_ref() else {
        return false;
    };
    resolve_damage_element(&effect.element, stats) == rune_to_element(last_generated_rune)
}

fn apply_heart_stats(
    mut stats: BaseStats,
    heart: &HuppermageHeart,
    state: &HuppermageState,
) -> BaseStats {
    if !has_passive(state, "altruisme-de-lame") {
        stats.damage_inflicted_percent += 30.0;
    }
    stats.heals_performed_percent += if has_passive(state, "altruisme-de-lame") {
        30.0
    } else {
        15.0
    };

    if !has_passive(state, "refraction-elementaire") {
        let heart_mastery = (max_elemental_mastery(&stats.elemental_mastery) * 1.2).floor();
        set_heart_elemental_mastery(&mut stats.elemental_mastery, heart, heart_mastery);
    }

    if has_passive(state, "initiative-de-lame") {
        keep_only_heart_elemental_mastery(&mut stats.elemental_mastery, heart);
    }

    stats
}

fn max_elemental_mastery(mastery: &ElementalMastery) -> f64 {
    mastery
        .fire
        .max(mastery.water)
        .max(mastery.earth)
        .max(mastery.air)
        .max(mastery.light)
        .max(mastery.neutral)
        .max(0.0)
}

fn set_heart_elemental_mastery(
    mastery: &mut ElementalMastery,
    heart: &HuppermageHeart,
    value: f64,
) {
    match heart {
        HuppermageHeart::Fire => mastery.fire = value,
        HuppermageHeart::Water => mastery.water = value,
        HuppermageHeart::Earth => mastery.earth = value,
        HuppermageHeart::Air => mastery.air = value,
    }
}

fn keep_only_heart_elemental_mastery(mastery: &mut ElementalMastery, heart: &HuppermageHeart) {
    if heart != &HuppermageHeart::Fire {
        mastery.fire = 0.0;
    }
    if heart != &HuppermageHeart::Water {
        mastery.water = 0.0;
    }
    if heart != &HuppermageHeart::Earth {
        mastery.earth = 0.0;
    }
    if heart != &HuppermageHeart::Air {
        mastery.air = 0.0;
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
    resources.add_resource(resource, f64::from(amount));
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

fn get_extra_mastery(stats: &BaseStats, context: &ActionContext, is_critical: bool) -> f64 {
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
        + if is_critical {
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
) -> Option<(&'static str, f64, f64)> {
    cost.amounts()
        .into_iter()
        .filter_map(|(resource, required)| {
            resources
                .amount(resource)
                .map(|available| (resource, required, available))
        })
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
            request_available_sublimations: request.available_sublimation_ids.len() as u32,
        },
    }
}

pub fn generate_hybrid_candidates(
    request: &OptimizerRequest,
) -> Result<HybridCandidateBatchResponse, String> {
    let mut metrics = BTreeMap::new();
    let supported = request.engine == "hybrid";
    if !supported {
        return Ok(HybridCandidateBatchResponse {
            schema_version: request.schema_version,
            backend: "rustWasm".to_string(),
            supported,
            engine: request.engine.clone(),
            seed: request.seed.clone(),
            attempts: 0,
            candidates: vec![],
            metrics,
        });
    }

    let mut rng = SeededRandom::new(&format!("{}:hybrid:batch", request.seed));
    let mut candidates = Vec::with_capacity(request.iterations as usize);

    for _ in 0..request.iterations {
        let use_resource_aware = rng.chance(0.12);
        let mode = if use_resource_aware {
            *metrics
                .entry("hybridResourceAwareCandidates".to_string())
                .or_insert(0) += 1;
            "resourceAware"
        } else {
            "random"
        };
        let candidate = sample_candidate_with_rng(request, mode, &mut rng)?;
        candidates.push(normalize_candidate(candidate));
    }

    metrics.insert(
        "rustWasmGeneratedCandidates".to_string(),
        candidates.len() as u32,
    );

    Ok(HybridCandidateBatchResponse {
        schema_version: request.schema_version,
        backend: "rustWasm".to_string(),
        supported,
        engine: request.engine.clone(),
        seed: request.seed.clone(),
        attempts: candidates.len() as u32,
        candidates,
        metrics,
    })
}

const DEFAULT_RUST_EVALUATION_CACHE_LIMIT: usize = 20_000;

struct HybridSearchAccumulator {
    attempts: u32,
    valid_candidates: u32,
    invalid_candidates: u32,
    top_candidates: Vec<ScoredTopCandidateEntry>,
    metrics: BTreeMap<String, u32>,
    resume_state: Option<HybridIslandResumeState>,
}

struct HybridTrackedEvaluation {
    population_entry: Option<HybridPopulationEntry>,
    improved: bool,
    repair_candidate: Option<OptimizerCandidateInput>,
}

struct DirectEvaluatorCache {
    limit: usize,
    entries: HashMap<u128, CandidateEvaluationResult>,
    order: VecDeque<u128>,
    metrics: EvaluatorCacheMetrics,
}

impl DirectEvaluatorCache {
    fn new(limit: usize) -> Self {
        Self {
            limit,
            entries: HashMap::new(),
            order: VecDeque::new(),
            metrics: EvaluatorCacheMetrics::default(),
        }
    }

    fn get(&mut self, key: u128) -> Option<CandidateEvaluationResult> {
        if let Some(cached) = self.entries.get(&key).cloned() {
            self.metrics.cache_hits += 1;
            Some(cached)
        } else {
            self.metrics.cache_misses += 1;
            None
        }
    }

    fn insert(&mut self, key: u128, value: CandidateEvaluationResult) {
        if self.limit == 0 {
            return;
        }
        if self.entries.len() >= self.limit {
            while self.entries.len() >= self.limit {
                if let Some(oldest_key) = self.order.pop_front() {
                    if self.entries.remove(&oldest_key).is_some() {
                        self.metrics.cache_evictions += 1;
                        break;
                    }
                } else {
                    break;
                }
            }
        }
        self.entries.insert(key, value);
        self.order.push_back(key);
    }

    fn metrics(&self) -> EvaluatorCacheMetrics {
        self.metrics.clone()
    }
}

fn increment_metric(metrics: &mut BTreeMap<String, u32>, key: &str, amount: u32) {
    if amount == 0 {
        return;
    }
    *metrics.entry(key.to_string()).or_insert(0) += amount;
}

fn merge_metric_maps(target: &mut BTreeMap<String, u32>, source: BTreeMap<String, u32>) {
    for (key, value) in source {
        increment_metric(target, &key, value);
    }
}

fn create_hybrid_fresh_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    rng: &mut SeededRandom,
    warmup_candidates: &[OptimizerCandidateInput],
    warmup_index: &mut usize,
    metrics: &mut BTreeMap<String, u32>,
) -> OptimizerCandidateInput {
    if let Some(candidate) = warmup_candidates.get(*warmup_index) {
        *warmup_index += 1;
        increment_metric(metrics, "hybridDomainWarmupCandidates", 1);
        return candidate.clone();
    }

    if rng.chance(0.12) {
        increment_metric(metrics, "hybridResourceAwareCandidates", 1);
        create_resource_aware_candidate(request, catalog, actions, rng)
    } else {
        create_random_candidate(request, catalog, actions, rng)
    }
}

fn tournament_select_population<'a>(
    population: &'a [HybridPopulationEntry],
    rng: &mut SeededRandom,
) -> &'a HybridPopulationEntry {
    let left = rng.pick(population);
    let right = rng.pick(population);
    if compare_population_entries(left, right) != std::cmp::Ordering::Greater {
        left
    } else {
        right
    }
}

fn create_hybrid_offspring_candidate(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    population: &[HybridPopulationEntry],
    rng: &mut SeededRandom,
    warmup_candidates: &[OptimizerCandidateInput],
    warmup_index: &mut usize,
    metrics: &mut BTreeMap<String, u32>,
) -> Result<OptimizerCandidateInput, String> {
    if rng.chance(0.18) {
        return Ok(create_hybrid_fresh_candidate(
            request,
            catalog,
            actions,
            rng,
            warmup_candidates,
            warmup_index,
            metrics,
        ));
    }

    let parent_a = tournament_select_population(population, rng);
    let parent_b = tournament_select_population(population, rng);
    let child = crossover_candidates_with_catalog(
        request,
        catalog,
        &parent_a.candidate,
        &parent_b.candidate,
        rng,
    )?;
    mutate_candidate_with_catalog(request, catalog, actions, &child, rng)
}

fn should_skip_hybrid_elite_neighbor(
    request: &OptimizerRequest,
    elite_neighbor_queue_len: usize,
    population_size: u32,
    consecutive_elite_neighbor_attempts: u32,
) -> bool {
    request.iterations >= 160
        && request.iterations < 240
        && (request.duration >= 3 || request.max_actions_per_turn >= 8)
        && !(request.duration == 3 && request.max_passive_count == 3)
        && elite_neighbor_queue_len > population_size as usize
        && consecutive_elite_neighbor_attempts >= 3
}

fn evaluate_candidate_with_cache(
    request: &OptimizerRequest,
    candidate: &OptimizerCandidateInput,
    candidate_hash: u128,
    catalog: &[SearchCatalogEntry],
    spells_by_id: &BTreeMap<&str, &SearchCatalogEntry>,
    cache: &mut DirectEvaluatorCache,
) -> Result<CandidateEvaluationResult, String> {
    if let Some(evaluation) = cache.get(candidate_hash) {
        return Ok(evaluation);
    }

    let evaluation =
        evaluate_candidate_with_catalog(request, candidate, "", catalog, spells_by_id)?;
    cache.insert(candidate_hash, evaluation.clone());
    Ok(evaluation)
}

fn create_repair_candidate_from_evaluation(
    candidate: &OptimizerCandidateInput,
    evaluation: &CandidateEvaluationResult,
) -> Option<OptimizerCandidateInput> {
    let violation = evaluation.first_violation.as_ref()?;
    if violation.action_index < 0 {
        return None;
    }
    create_hybrid_repair_candidate(
        candidate,
        &HybridViolationInput {
            violation_type: violation.violation_type.clone(),
            turn_index: violation.turn_index,
            action_index: violation.action_index as u32,
        },
    )
}

fn evaluate_and_track_hybrid_candidate(
    request: &OptimizerRequest,
    candidate: OptimizerCandidateInput,
    accumulator: &mut HybridSearchAccumulator,
    max_candidates: usize,
    catalog: &[SearchCatalogEntry],
    spells_by_id: &BTreeMap<&str, &SearchCatalogEntry>,
    cache: &mut DirectEvaluatorCache,
) -> Result<HybridTrackedEvaluation, String> {
    let candidate = normalize_candidate(candidate);
    let candidate_hash = hash_candidate(&candidate);
    let previous_best = accumulator.top_candidates.first().cloned();

    accumulator.attempts += 1;
    increment_metric(&mut accumulator.metrics, "rustWasmGeneratedCandidates", 1);
    increment_metric(&mut accumulator.metrics, "rustWasmCandidateEvaluations", 1);

    let evaluation = evaluate_candidate_with_cache(
        request,
        &candidate,
        candidate_hash,
        catalog,
        spells_by_id,
        cache,
    )?;

    if evaluation.valid {
        accumulator.valid_candidates += 1;
        if let Some(score) = evaluation.score.clone() {
            let id = encode_candidate(&candidate);
            add_scored_top_candidate(
                &mut accumulator.top_candidates,
                max_candidates,
                ScoredTopCandidateEntry {
                    id: id.clone(),
                    passive_ids: candidate.passive_ids.clone(),
                    sublimation_ids: candidate.sublimation_ids.clone(),
                    plan: candidate.plan.clone(),
                    score: score.clone(),
                },
            );
            let improved = match (&previous_best, accumulator.top_candidates.first()) {
                (None, Some(_)) => true,
                (Some(previous), Some(current)) => {
                    compare_scored_top_candidates(current, previous) == std::cmp::Ordering::Less
                }
                _ => false,
            };
            return Ok(HybridTrackedEvaluation {
                population_entry: Some(HybridPopulationEntry {
                    id,
                    candidate,
                    score: score.score,
                    valid: true,
                }),
                improved,
                repair_candidate: None,
            });
        }
    } else {
        accumulator.invalid_candidates += 1;
    }

    let repair_candidate = create_repair_candidate_from_evaluation(&candidate, &evaluation);
    Ok(HybridTrackedEvaluation {
        population_entry: None,
        improved: false,
        repair_candidate,
    })
}

fn enqueue_repair_candidate_for_search(
    request: &OptimizerRequest,
    repair_queue: &mut VecDeque<OptimizerCandidateInput>,
    repair_queue_keys: &mut HashSet<u128>,
    repair_candidate: Option<OptimizerCandidateInput>,
    metrics: &mut BTreeMap<String, u32>,
) {
    let Some(candidate) = repair_candidate else {
        return;
    };
    if repair_queue.len() >= 512 || (request.duration < 3 && request.iterations < 80) {
        return;
    }

    let normalized = normalize_candidate(candidate);
    let key = hash_candidate(&normalized);
    if !repair_queue_keys.insert(key) {
        return;
    }

    repair_queue.push_back(normalized);
    increment_metric(metrics, "hybridRepairQueueCandidates", 1);
}

fn enqueue_elite_neighbors_for_search(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    elite_neighbor_queue: &mut Vec<OptimizerCandidateInput>,
    candidate: &OptimizerCandidateInput,
    metrics: &mut BTreeMap<String, u32>,
) -> Result<(), String> {
    let result = enqueue_hybrid_elite_neighbors_with_catalog(
        request,
        catalog,
        std::mem::take(elite_neighbor_queue),
        candidate,
    )?;
    *elite_neighbor_queue = result.queue;
    merge_metric_maps(metrics, result.metrics);
    Ok(())
}

fn run_hybrid_island_search(
    request: &OptimizerRequest,
    max_candidates: usize,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
    spells_by_id: &BTreeMap<&str, &SearchCatalogEntry>,
    cache: &mut DirectEvaluatorCache,
    restart_index_offset: u32,
    resume_state: Option<&HybridIslandResumeState>,
) -> Result<HybridSearchAccumulator, String> {
    let config = create_hybrid_population_config(request.iterations);
    let mut accumulator = HybridSearchAccumulator {
        attempts: 0,
        valid_candidates: 0,
        invalid_candidates: 0,
        top_candidates: Vec::new(),
        metrics: BTreeMap::new(),
        resume_state: None,
    };
    let mut rng = resume_state
        .map(|state| SeededRandom::from_state(state.rng_state))
        .unwrap_or_else(|| SeededRandom::new(&format!("{}:hybrid:run", request.seed)));
    let warmup_candidates = create_domain_warmup_candidates(request, catalog, actions);
    let mut warmup_index = resume_state.map(|state| state.warmup_index).unwrap_or(0);
    let mut population: Vec<HybridPopulationEntry> = resume_state
        .map(|state| truncate_population(state.population.clone(), config.population_size))
        .unwrap_or_default();
    let mut elite_neighbor_queue: Vec<OptimizerCandidateInput> = resume_state
        .map(|state| state.elite_neighbor_queue.clone())
        .unwrap_or_default();
    let mut repair_queue: VecDeque<OptimizerCandidateInput> = resume_state
        .map(|state| VecDeque::from(state.repair_queue.clone()))
        .unwrap_or_default();
    let mut repair_queue_keys: HashSet<u128> = repair_queue
        .iter()
        .map(hash_candidate)
        .collect::<HashSet<_>>();
    let mut attempts_since_improvement = resume_state
        .map(|state| state.attempts_since_improvement)
        .unwrap_or(0);
    let mut consecutive_repair_attempts = resume_state
        .map(|state| state.consecutive_repair_attempts)
        .unwrap_or(0);
    let mut consecutive_elite_neighbor_attempts = resume_state
        .map(|state| state.consecutive_elite_neighbor_attempts)
        .unwrap_or(0);
    let mut restart_index = resume_state
        .map(|state| state.restart_index)
        .unwrap_or(restart_index_offset);

    while accumulator.attempts < request.iterations
        && population.len() < config.population_size as usize
    {
        let input = create_hybrid_fresh_candidate(
            request,
            catalog,
            actions,
            &mut rng,
            &warmup_candidates,
            &mut warmup_index,
            &mut accumulator.metrics,
        );
        let tracked = evaluate_and_track_hybrid_candidate(
            request,
            input,
            &mut accumulator,
            max_candidates,
            catalog,
            spells_by_id,
            cache,
        )?;
        attempts_since_improvement = if tracked.improved {
            0
        } else {
            attempts_since_improvement + 1
        };
        if let Some(entry) = tracked.population_entry {
            if tracked.improved {
                enqueue_elite_neighbors_for_search(
                    request,
                    catalog,
                    &mut elite_neighbor_queue,
                    &entry.candidate,
                    &mut accumulator.metrics,
                )?;
            }
            population.push(entry);
        } else {
            enqueue_repair_candidate_for_search(
                request,
                &mut repair_queue,
                &mut repair_queue_keys,
                tracked.repair_candidate,
                &mut accumulator.metrics,
            );
        }
    }

    population = truncate_population(population, config.population_size);

    while accumulator.attempts < request.iterations {
        if population.len() < 2 {
            consecutive_repair_attempts = 0;
            consecutive_elite_neighbor_attempts = 0;
            let input = create_hybrid_fresh_candidate(
                request,
                catalog,
                actions,
                &mut rng,
                &warmup_candidates,
                &mut warmup_index,
                &mut accumulator.metrics,
            );
            let tracked = evaluate_and_track_hybrid_candidate(
                request,
                input,
                &mut accumulator,
                max_candidates,
                catalog,
                spells_by_id,
                cache,
            )?;
            attempts_since_improvement = if tracked.improved {
                0
            } else {
                attempts_since_improvement + 1
            };
            if let Some(entry) = tracked.population_entry {
                if tracked.improved {
                    enqueue_elite_neighbors_for_search(
                        request,
                        catalog,
                        &mut elite_neighbor_queue,
                        &entry.candidate,
                        &mut accumulator.metrics,
                    )?;
                }
                population.push(entry);
                population = truncate_population(population, config.population_size);
            } else {
                enqueue_repair_candidate_for_search(
                    request,
                    &mut repair_queue,
                    &mut repair_queue_keys,
                    tracked.repair_candidate,
                    &mut accumulator.metrics,
                );
            }
            continue;
        }

        if attempts_since_improvement >= config.stagnation_limit {
            let restart = inject_hybrid_immigrants_with_catalog(
                request,
                catalog,
                actions,
                population,
                restart_index,
            )?;
            restart_index += 1;
            merge_metric_maps(&mut accumulator.metrics, restart.metrics);
            population = restart.retained_elites;
            let mut improved = false;
            for immigrant in restart.immigrants {
                if accumulator.attempts >= request.iterations {
                    break;
                }
                let tracked = evaluate_and_track_hybrid_candidate(
                    request,
                    immigrant.candidate,
                    &mut accumulator,
                    max_candidates,
                    catalog,
                    spells_by_id,
                    cache,
                )?;
                improved = improved || tracked.improved;
                if let Some(entry) = tracked.population_entry {
                    if tracked.improved {
                        enqueue_elite_neighbors_for_search(
                            request,
                            catalog,
                            &mut elite_neighbor_queue,
                            &entry.candidate,
                            &mut accumulator.metrics,
                        )?;
                    }
                    population.push(entry);
                } else {
                    enqueue_repair_candidate_for_search(
                        request,
                        &mut repair_queue,
                        &mut repair_queue_keys,
                        tracked.repair_candidate,
                        &mut accumulator.metrics,
                    );
                }
            }
            population = truncate_population(population, config.population_size);
            attempts_since_improvement = if improved {
                0
            } else {
                restart.attempts_since_improvement
            };
            consecutive_repair_attempts = 0;
            consecutive_elite_neighbor_attempts = 0;
            continue;
        }

        let can_process_repair =
            !repair_queue.is_empty() && consecutive_repair_attempts < config.repair_burst_limit;
        if !repair_queue.is_empty() && !can_process_repair {
            increment_metric(&mut accumulator.metrics, "hybridRepairDeferrals", 1);
        }
        let repair_candidate = if can_process_repair {
            repair_queue.pop_front()
        } else {
            None
        };
        let should_refine_locally = repair_candidate.is_none()
            && request.iterations >= config.local_refinement_preemption_budget
            && (accumulator.attempts % config.local_refinement_interval == 0
                || (request.iterations >= config.stagnation_refinement_budget
                    && (request.duration >= 3 || request.max_actions_per_turn >= 8)
                    && attempts_since_improvement >= config.stagnation_limit / 2
                    && accumulator.attempts % config.stagnation_refinement_interval == 0));
        let skip_elite_neighbor = repair_candidate.is_none()
            && !should_refine_locally
            && should_skip_hybrid_elite_neighbor(
                request,
                elite_neighbor_queue.len(),
                config.population_size,
                consecutive_elite_neighbor_attempts,
            );
        let elite_neighbor = if repair_candidate.is_none()
            && !should_refine_locally
            && !skip_elite_neighbor
            && !elite_neighbor_queue.is_empty()
        {
            Some(elite_neighbor_queue.remove(0))
        } else {
            None
        };

        let input = if let Some(candidate) = repair_candidate.clone() {
            increment_metric(&mut accumulator.metrics, "hybridRepairCandidates", 1);
            consecutive_repair_attempts += 1;
            candidate
        } else if should_refine_locally {
            consecutive_repair_attempts = 0;
            increment_metric(&mut accumulator.metrics, "hybridLocalRefinements", 1);
            create_hybrid_local_refinement_with_catalog(
                request,
                catalog,
                actions,
                &population,
                &mut rng,
            )?
        } else if let Some(candidate) = elite_neighbor.clone() {
            consecutive_repair_attempts = 0;
            increment_metric(&mut accumulator.metrics, "hybridEliteNeighborCandidates", 1);
            candidate
        } else {
            consecutive_repair_attempts = 0;
            if skip_elite_neighbor {
                increment_metric(&mut accumulator.metrics, "hybridEliteNeighborDeferrals", 1);
            }
            create_hybrid_offspring_candidate(
                request,
                catalog,
                actions,
                &population,
                &mut rng,
                &warmup_candidates,
                &mut warmup_index,
                &mut accumulator.metrics,
            )?
        };

        let used_elite_neighbor = elite_neighbor.is_some();
        let tracked = evaluate_and_track_hybrid_candidate(
            request,
            input,
            &mut accumulator,
            max_candidates,
            catalog,
            spells_by_id,
            cache,
        )?;
        attempts_since_improvement = if tracked.improved {
            0
        } else {
            attempts_since_improvement + 1
        };
        consecutive_elite_neighbor_attempts = if used_elite_neighbor && !tracked.improved {
            consecutive_elite_neighbor_attempts + 1
        } else {
            0
        };

        if let Some(entry) = tracked.population_entry {
            if tracked.improved {
                enqueue_elite_neighbors_for_search(
                    request,
                    catalog,
                    &mut elite_neighbor_queue,
                    &entry.candidate,
                    &mut accumulator.metrics,
                )?;
            }
            population.push(entry);
            population = truncate_population(population, config.population_size);
        } else {
            enqueue_repair_candidate_for_search(
                request,
                &mut repair_queue,
                &mut repair_queue_keys,
                tracked.repair_candidate,
                &mut accumulator.metrics,
            );
        }
    }

    increment_metric(
        &mut accumulator.metrics,
        "populationSize",
        population.len() as u32,
    );
    increment_metric(
        &mut accumulator.metrics,
        "hybridEliteCount",
        std::cmp::min(config.elite_count, population.len() as u32),
    );
    increment_metric(
        &mut accumulator.metrics,
        "hybridStagnationLimit",
        config.stagnation_limit,
    );

    accumulator.resume_state = Some(HybridIslandResumeState {
        island_index: restart_index_offset,
        seed: request.seed.clone(),
        rng_state: rng.state_snapshot(),
        warmup_index,
        restart_index,
        attempts_since_improvement,
        consecutive_repair_attempts,
        consecutive_elite_neighbor_attempts,
        population,
        repair_queue: repair_queue.into_iter().collect(),
        elite_neighbor_queue,
    });

    Ok(accumulator)
}

fn create_domain_warmup_candidates(
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    actions: &[CandidateAction],
) -> Vec<OptimizerCandidateInput> {
    let action_by_key = actions
        .iter()
        .map(|action| (encode_candidate_action(action), action.clone()))
        .collect::<BTreeMap<_, _>>();
    let available_passives = get_available_passive_ids(request, catalog)
        .into_iter()
        .collect::<BTreeSet<_>>();
    let mut candidates = Vec::new();

    for seed in huppermage_domain_seed_candidates() {
        if seed.turns.len() as u32 > request.duration
            || seed
                .max_duration
                .is_some_and(|max_duration| request.duration > max_duration)
            || seed
                .min_passive_count
                .is_some_and(|min_count| request.max_passive_count < min_count)
        {
            continue;
        }

        let passive_variants = create_domain_seed_passive_variants(
            &seed.passive_ids,
            request,
            catalog,
            &available_passives,
        );
        if passive_variants.is_empty() {
            continue;
        }

        let mut turns = Vec::new();
        let mut supported = true;
        for seed_turn in &seed.turns {
            let projected_keys = project_domain_seed_turn(seed_turn, request, catalog);
            let mut actions = Vec::new();
            for action_key in projected_keys {
                let Some(action) = action_by_key.get(action_key) else {
                    supported = false;
                    break;
                };
                actions.push(action.clone());
            }
            if !supported {
                break;
            }
            turns.push(CandidateTurn { actions });
        }
        if !supported {
            continue;
        }

        while turns.len() < request.duration as usize {
            turns.push(CandidateTurn { actions: vec![] });
        }

        for passive_ids in passive_variants {
            candidates.push(OptimizerCandidateInput {
                passive_ids,
                sublimation_ids: pick_domain_seed_sublimations(request),
                plan: CandidatePlan {
                    turns: turns.clone(),
                },
            });
        }
    }

    candidates
}

fn create_domain_seed_passive_variants(
    passive_ids: &[&'static str],
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
    available_passives: &BTreeSet<String>,
) -> Vec<Vec<String>> {
    let available_seed_passives = passive_ids
        .iter()
        .filter(|passive_id| available_passives.contains(**passive_id))
        .map(|passive_id| passive_id.to_string())
        .collect::<Vec<_>>();
    let passive_limit = std::cmp::min(
        request.max_passive_count as usize,
        available_seed_passives.len(),
    );
    if passive_limit == 0 {
        return vec![vec![]];
    }
    if available_seed_passives.len() <= request.max_passive_count as usize {
        return vec![available_seed_passives];
    }

    let mut variants = combine_passive_variants(&available_seed_passives, passive_limit);
    variants.sort_by(|left, right| {
        score_passive_variant(right, request, catalog)
            .partial_cmp(&score_passive_variant(left, request, catalog))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    variants.truncate(24);
    variants
}

fn combine_passive_variants(passive_ids: &[String], size: usize) -> Vec<Vec<String>> {
    if size == 0 {
        return vec![vec![]];
    }
    if passive_ids.len() < size {
        return vec![];
    }

    let first = passive_ids[0].clone();
    let remaining = &passive_ids[1..];
    let mut with_first = combine_passive_variants(remaining, size - 1)
        .into_iter()
        .map(|mut variant| {
            variant.push(first.clone());
            variant.sort();
            variant
        })
        .collect::<Vec<_>>();
    let mut without_first = combine_passive_variants(remaining, size);
    with_first.append(&mut without_first);
    with_first
}

fn score_passive_variant(
    passive_ids: &[String],
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
) -> f64 {
    passive_ids
        .iter()
        .map(|passive_id| get_passive_search_weight(passive_id, request, catalog))
        .sum()
}

fn project_domain_seed_turn(
    seed_turn: &[&'static str],
    request: &OptimizerRequest,
    catalog: &[SearchCatalogEntry],
) -> Vec<&'static str> {
    if seed_turn.len() <= request.max_actions_per_turn as usize {
        return seed_turn.to_vec();
    }

    let pivot_spell_ids = BTreeSet::from([
        "coeur-de-lumiere",
        "runification",
        "fleche-de-lumiere",
        "epee-de-lumiere",
        "halo-chatoyant",
    ]);
    let entries_by_id = catalog
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let mut scored = seed_turn
        .iter()
        .enumerate()
        .map(|(index, action_key)| {
            let spell_id = action_key.split('@').next().unwrap_or(action_key);
            let spell = entries_by_id.get(spell_id);
            (
                *action_key,
                index,
                pivot_spell_ids.contains(spell_id),
                spell
                    .map(|entry| get_action_search_weight(entry))
                    .unwrap_or_default(),
            )
        })
        .collect::<Vec<_>>();
    let mut selected_indexes = scored
        .iter()
        .filter(|(_, _, keep, _)| *keep)
        .take(request.max_actions_per_turn as usize)
        .map(|(_, index, _, _)| *index)
        .collect::<BTreeSet<_>>();

    scored.sort_by(|left, right| {
        right
            .3
            .partial_cmp(&left.3)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.1.cmp(&right.1))
    });
    for (_, index, _, _) in scored {
        if selected_indexes.len() >= request.max_actions_per_turn as usize {
            break;
        }
        selected_indexes.insert(index);
    }

    seed_turn
        .iter()
        .enumerate()
        .filter(|(index, _)| selected_indexes.contains(index))
        .map(|(_, action_key)| *action_key)
        .collect()
}

fn huppermage_domain_seed_candidates() -> Vec<DomainSeedCandidate> {
    vec![
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "debacle",
                    "fleche-de-lumiere",
                    "epee-de-lumiere",
                    "eboulement",
                    "ombres-dansantes",
                    "halo-chatoyant",
                ],
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "eboulement",
                    "papillons-diurnes",
                    "debacle",
                    "orbes-luisants",
                    "halo-chatoyant@emptyCell",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "eboulement",
                    "coeur-de-lumiere",
                    "halo-chatoyant",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "debacle",
                    "fleche-de-lumiere",
                    "epee-de-lumiere",
                    "eboulement",
                    "ombres-dansantes",
                    "halo-chatoyant",
                ],
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "halo-chatoyant@emptyCell",
                    "papillons-diurnes",
                    "debacle",
                    "orbes-luisants",
                    "halo-chatoyant@emptyCell",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "eboulement",
                    "debacle",
                    "fleche-de-lumiere",
                    "ombres-dansantes",
                    "halo-chatoyant",
                    "epee-de-lumiere",
                ],
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "halo-chatoyant@emptyCell",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "eboulement",
                    "debacle",
                    "fleche-de-lumiere",
                    "ombres-dansantes",
                    "halo-chatoyant",
                    "epee-de-lumiere",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "eboulement",
                    "coeur-de-lumiere",
                    "flux-denergie",
                    "papillons-diurnes",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "debacle",
                    "debacle",
                    "fleche-de-lumiere",
                    "epee-de-lumiere",
                    "epee-de-lumiere",
                ],
            ],
            max_duration: Some(2),
            min_passive_count: Some(3),
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "eboulement",
                    "coeur-de-lumiere",
                    "flux-denergie",
                    "papillons-diurnes",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "eboulement",
                    "debacle",
                    "fleche-de-lumiere",
                    "orbes-luisants",
                    "epee-de-lumiere",
                ],
            ],
            max_duration: Some(2),
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "eboulement",
                    "coeur-de-lumiere",
                    "rayon-crepusculaire",
                    "flux-denergie",
                    "papillons-diurnes",
                    "debacle",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "debacle",
                    "fleche-de-lumiere",
                    "orbes-luisants",
                    "papillons-diurnes",
                    "epee-de-lumiere",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens"],
            turns: vec![
                vec![
                    "eboulement",
                    "coeur-de-lumiere",
                    "halo-chatoyant",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "debacle",
                    "fleche-de-lumiere",
                    "epee-de-lumiere",
                    "eboulement",
                    "ombres-dansantes",
                    "halo-chatoyant",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec!["carnage", "extension-des-sens", "profusion-runique"],
            turns: vec![
                vec![
                    "halo-chatoyant",
                    "eboulement",
                    "coeur-de-lumiere",
                    "papillons-diurnes",
                    "flux-denergie",
                    "debacle",
                    "orbes-luisants",
                    "orbes-luisants",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "papillons-diurnes",
                    "debacle",
                    "fleche-de-lumiere",
                    "eboulement",
                    "halo-chatoyant",
                    "epee-de-lumiere",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
        DomainSeedCandidate {
            passive_ids: vec![
                "carnage",
                "extension-des-sens",
                "fluctuation",
                "liaison-lumineuse",
                "profusion-runique",
                "sauvegarde-runique",
            ],
            turns: vec![
                vec![
                    "flux-denergie",
                    "eboulement",
                    "coeur-de-lumiere",
                    "papillons-diurnes",
                    "epee-de-lumiere",
                    "orbes-luisants",
                    "debacle",
                    "debacle",
                    "cycle-elementaire",
                ],
                vec![
                    "coeur-de-lumiere",
                    "runification",
                    "ombres-dansantes",
                    "debacle",
                    "fleche-de-lumiere",
                    "flux-denergie",
                    "halo-chatoyant@emptyCell",
                    "epee-de-lumiere",
                ],
            ],
            max_duration: None,
            min_passive_count: None,
        },
    ]
}

pub fn run_hybrid_search(request: &OptimizerRequest) -> Result<HybridSearchResponse, String> {
    let mut metrics = BTreeMap::new();
    let supported = request.engine == "hybrid";
    if !supported {
        return Ok(HybridSearchResponse {
            schema_version: request.schema_version,
            backend: "rustWasm".to_string(),
            supported,
            engine: request.engine.clone(),
            seed: request.seed.clone(),
            attempts: 0,
            valid_candidates: 0,
            invalid_candidates: 0,
            top_candidates: vec![],
            metrics,
            resume_state: None,
        });
    }

    let catalog = read_search_catalog(request)?;
    let actions = get_search_actions(request, &catalog);
    if actions.is_empty() {
        return Err("Cannot run Rust hybrid search without available spells.".to_string());
    }
    let spells_by_id = catalog
        .iter()
        .filter(|entry| entry.kind == "spell")
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let max_candidates = request.max_candidates.unwrap_or(20).clamp(1, 200) as usize;
    let schedule = create_hybrid_schedule(request);
    let mut cache = DirectEvaluatorCache::new(DEFAULT_RUST_EVALUATION_CACHE_LIMIT);
    let mut attempts = 0_u32;
    let mut valid_candidates = 0_u32;
    let mut invalid_candidates = 0_u32;
    let mut top_candidates = Vec::new();
    let mut resume_islands = Vec::new();

    for island in &schedule.islands {
        let mut island_request = request.clone();
        island_request.iterations = island.iterations;
        island_request.seed = island.rng_seed.clone();
        let island_resume_state = request.resume_state.as_ref().and_then(|state| {
            find_resume_island_state(state, island.island_index, &island.rng_seed)
        });
        let island_result = run_hybrid_island_search(
            &island_request,
            max_candidates,
            &catalog,
            &actions,
            &spells_by_id,
            &mut cache,
            island.island_index,
            island_resume_state,
        )?;

        attempts += island_result.attempts;
        valid_candidates += island_result.valid_candidates;
        invalid_candidates += island_result.invalid_candidates;
        merge_metric_maps(&mut metrics, island_result.metrics);
        if let Some(resume_state) = island_result.resume_state {
            resume_islands.push(resume_state);
        }
        for candidate in island_result.top_candidates {
            add_scored_top_candidate(&mut top_candidates, max_candidates, candidate);
        }
    }

    metrics.insert("hybridIslands".to_string(), schedule.island_count);
    let cache_metrics = cache.metrics();
    metrics.insert("cacheHits".to_string(), cache_metrics.cache_hits);
    metrics.insert("cacheMisses".to_string(), cache_metrics.cache_misses);
    metrics.insert("cacheEvictions".to_string(), cache_metrics.cache_evictions);
    metrics.insert("rustWasmCacheHits".to_string(), cache_metrics.cache_hits);
    metrics.insert(
        "rustWasmCacheMisses".to_string(),
        cache_metrics.cache_misses,
    );
    metrics.insert(
        "rustWasmCacheEvictions".to_string(),
        cache_metrics.cache_evictions,
    );
    metrics.insert(
        "rustWasmEvaluationCacheLimit".to_string(),
        DEFAULT_RUST_EVALUATION_CACHE_LIMIT as u32,
    );

    Ok(HybridSearchResponse {
        schema_version: request.schema_version,
        backend: "rustWasm".to_string(),
        supported,
        engine: request.engine.clone(),
        seed: request.seed.clone(),
        attempts,
        valid_candidates,
        invalid_candidates,
        top_candidates,
        metrics,
        resume_state: Some(HybridSearchResumeState {
            schema_version: request.schema_version,
            total_attempts: request
                .resume_state
                .as_ref()
                .map(|state| state.total_attempts)
                .unwrap_or(0)
                + attempts as u64,
            islands: resume_islands,
        }),
    })
}

fn find_resume_island_state<'a>(
    resume_state: &'a HybridSearchResumeState,
    island_index: u32,
    seed: &str,
) -> Option<&'a HybridIslandResumeState> {
    resume_state
        .islands
        .iter()
        .find(|state| state.seed == seed)
        .or_else(|| {
            resume_state
                .islands
                .iter()
                .find(|state| state.island_index == island_index)
        })
}

fn add_scored_top_candidate(
    top_candidates: &mut Vec<ScoredTopCandidateEntry>,
    max_candidates: usize,
    candidate: ScoredTopCandidateEntry,
) {
    if let Some(existing_index) = top_candidates
        .iter()
        .position(|existing| existing.id == candidate.id)
    {
        if compare_scored_top_candidates(&candidate, &top_candidates[existing_index])
            != std::cmp::Ordering::Less
        {
            return;
        }
        top_candidates[existing_index] = candidate;
        top_candidates.sort_by(compare_scored_top_candidates);
        return;
    }

    if top_candidates.len() < max_candidates {
        top_candidates.push(candidate);
        top_candidates.sort_by(compare_scored_top_candidates);
        return;
    }

    let Some(worst) = top_candidates.last() else {
        return;
    };
    if compare_scored_top_candidates(&candidate, worst) != std::cmp::Ordering::Less {
        return;
    }

    top_candidates.pop();
    top_candidates.push(candidate);
    top_candidates.sort_by(compare_scored_top_candidates);
}

fn compare_scored_top_candidates(
    left: &ScoredTopCandidateEntry,
    right: &ScoredTopCandidateEntry,
) -> std::cmp::Ordering {
    right
        .score
        .score
        .partial_cmp(&left.score.score)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| left.passive_ids.len().cmp(&right.passive_ids.len()))
        .then_with(|| left.sublimation_ids.len().cmp(&right.sublimation_ids.len()))
        .then_with(|| count_plan_actions(&left.plan).cmp(&count_plan_actions(&right.plan)))
        .then_with(|| left.id.cmp(&right.id))
}

fn count_plan_actions(plan: &CandidatePlan) -> usize {
    plan.turns.iter().map(|turn| turn.actions.len()).sum()
}

pub fn evaluate_candidate(
    request: &OptimizerRequest,
    candidate: &OptimizerCandidateInput,
    candidate_id: &str,
) -> Result<CandidateEvaluationResult, String> {
    let catalog = read_search_catalog(request)?;
    let spells_by_id = catalog
        .iter()
        .filter(|entry| entry.kind == "spell")
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    evaluate_candidate_with_catalog(request, candidate, candidate_id, &catalog, &spells_by_id)
}

fn evaluate_candidate_with_catalog<'a>(
    request: &OptimizerRequest,
    candidate: &OptimizerCandidateInput,
    candidate_id: &str,
    catalog: &'a [SearchCatalogEntry],
    spells_by_id: &BTreeMap<&'a str, &'a SearchCatalogEntry>,
) -> Result<CandidateEvaluationResult, String> {
    if let Some(sublimation_id) = validate_candidate_sublimations(candidate) {
        return Ok(create_candidate_evaluation_result(
            candidate_id,
            false,
            0.0,
            read_request_resources(&request.character),
            create_huppermage_state(read_request_resources(&request.character), vec![]),
            None,
            Some(CandidateEvaluationViolation {
                turn_index: 0,
                violation_type: "invalidSublimation".to_string(),
                action_index: -1,
                spell_id: Some(sublimation_id),
                resource: None,
                required: None,
                available: None,
                scope: None,
            }),
        ));
    }

    let mut base_resources = read_request_resources(&request.character);
    let mut base_stats = read_request_stats(&request.character);
    let active_passive_ids = candidate.passive_ids.clone();
    let passives = read_passive_entries_from_catalog(catalog, &active_passive_ids);
    let mut huppermage =
        read_request_huppermage(&request.character, base_resources, active_passive_ids);
    let initial_passives =
        apply_initial_passive_effects(base_stats.clone(), base_resources, &passives);
    base_stats = initial_passives.stats;
    base_resources = initial_passives.resources;
    apply_initial_sublimations(
        candidate,
        &request.character,
        &mut base_stats,
        &mut base_resources,
    );

    let default_context = request
        .default_action_context
        .as_ref()
        .and_then(|value| serde_json::from_value::<PartialActionContext>(value.clone()).ok());
    let mut resources = base_resources;
    let mut total_damage = 0.0;
    let mut damage_by_resolved_element = DamageByElement::default();
    let mut sublimation_state = create_sublimation_combat_state(&request.character);

    for (turn_index, turn) in candidate.plan.turns.iter().enumerate() {
        let mut turn_damage = 0.0;
        let mut turn_stats = base_stats.clone();
        let mut casts_by_spell_id = BTreeMap::new();
        let mut target_casts_by_spell_id = BTreeMap::new();

        for (action_index, action) in turn.actions.iter().enumerate() {
            let Some(spell) = spells_by_id.get(action.spell_id.as_str()) else {
                return Ok(create_candidate_evaluation_result(
                    candidate_id,
                    false,
                    round_damage(total_damage + turn_damage),
                    resources,
                    huppermage,
                    None,
                    Some(violation_with_turn(
                        turn_index as u32,
                        &create_unknown_spell_violation(&action.spell_id, action_index as u32),
                    )),
                ));
            };

            let action_context = action.context.clone().or_else(|| default_context.clone());
            let rules = create_spell_rules_from_search_entry(spell);
            let target = action.target.as_ref().map(|target| target.kind.clone());
            if let Some(violation) = validate_spell_rules(
                &rules,
                action_index as u32,
                target.clone(),
                &casts_by_spell_id,
                &target_casts_by_spell_id,
                &huppermage,
            )
            .or_else(|| {
                validate_huppermage_class_action(
                    &spell.id,
                    action_index as u32,
                    target.clone(),
                    &casts_by_spell_id,
                    &huppermage,
                )
            }) {
                return Ok(create_candidate_evaluation_result(
                    candidate_id,
                    false,
                    round_damage(total_damage + turn_damage),
                    resources,
                    huppermage,
                    None,
                    Some(violation_with_turn(turn_index as u32, &violation)),
                ));
            }

            let effective_cost =
                resolve_search_effective_cost(spell, &huppermage, action, &casts_by_spell_id);
            let resource_validation = validate_resource_cost(
                resources,
                effective_cost,
                &spell.id,
                action_index as u32,
                action_context.clone(),
            );
            if let Some(violation) = resource_validation.violation {
                return Ok(create_candidate_evaluation_result(
                    candidate_id,
                    false,
                    round_damage(total_damage + turn_damage),
                    resources,
                    huppermage,
                    None,
                    Some(resource_violation_with_turn(turn_index as u32, &violation)),
                ));
            }
            resources = resource_validation.resources_after_cost;
            add_spent_resources_for_sublimations(&mut sublimation_state, effective_cost);

            if spell.id == "cycle-elementaire" {
                let cycle = apply_cycle_elementaire(huppermage, resources);
                huppermage = cycle.state;
                resources = cycle.resources;
            }

            if spell.id == "coeur-de-lumiere" {
                let heart = huppermage
                    .runes
                    .last_generated_rune
                    .as_ref()
                    .map(rune_to_heart);
                if let Some(heart) = heart {
                    turn_stats = apply_heart_stats(turn_stats, &heart, &huppermage);
                    huppermage.active_heart = Some(heart);
                    if action_index == 0 && has_passive(&huppermage, "initiative-de-lame") {
                        resources.ap += 2.0;
                    }
                }
            }

            apply_search_resource_deltas(spell, &huppermage, action, &mut resources);
            apply_search_stat_modifiers(spell, &huppermage, action, &mut turn_stats);
            apply_passive_spell_stat_modifiers(spell, &huppermage, &mut turn_stats);

            let generated_rune = spell.element.as_ref().and_then(element_to_rune);
            let generated_rune_was_active = generated_rune
                .as_ref()
                .is_some_and(|rune| is_rune_active(&huppermage.runes.active, rune));
            let mut action_stats = turn_stats.clone();
            if spell.element == Some(Element::Light) && huppermage.abundance_level > 0 {
                action_stats.damage_inflicted_percent += huppermage.abundance_level as f64;
                huppermage.abundance_level = 0;
            }
            action_stats.damage_inflicted_percent += collect_search_damage_inflicted_bonus_percent(
                spell,
                &huppermage,
                &action,
                resources,
            );
            action_stats.damage_inflicted_percent += collect_sublimation_damage_bonus_percent(
                candidate,
                spell,
                effective_cost,
                &mut sublimation_state,
            );

            let mut action_damage = 0.0;
            if !is_empty_cell_action(action) {
                for effect in collect_search_damage_effects(spell) {
                    let mut damage_stats = action_stats.clone();
                    if damage_matches_last_generated_rune(&damage_stats, &effect, &huppermage) {
                        damage_stats.damage_inflicted_percent += 20.0;
                    }
                    let damage = compute_raw_damage(&damage_stats, &effect, action_context.clone());
                    action_damage = round_damage(action_damage + damage.result);
                    turn_damage = round_damage(turn_damage + damage.result);
                    damage_by_resolved_element = add_resolved_element_damage(
                        damage_by_resolved_element,
                        &damage.resolved_element,
                        damage.result,
                    );
                }
            }

            if spell.id == "orbes-luisants" {
                let active_rune_count = get_active_rune_count(&huppermage);
                if active_rune_count > 0 {
                    huppermage = add_abundance(huppermage, (active_rune_count as i32) * 10).state;
                }
            }

            for (element, damage) in
                collect_search_delayed_damage(spell, &huppermage, action, action_damage)
            {
                turn_damage = round_damage(turn_damage + damage);
                damage_by_resolved_element =
                    add_resolved_element_damage(damage_by_resolved_element, &element, damage);
            }

            if let Some(halo_damage) = apply_halo_chatoyant_damage(spell, &mut huppermage, action) {
                let damage =
                    compute_raw_damage(&action_stats, &halo_damage, action_context.clone());
                turn_damage = round_damage(turn_damage + damage.result);
                damage_by_resolved_element = add_resolved_element_damage(
                    damage_by_resolved_element,
                    &damage.resolved_element,
                    damage.result,
                );
            }

            let consumed_runes = collect_search_consumed_runes(spell, &huppermage, action);
            if !consumed_runes.is_empty() {
                let consumed_count = consumed_runes.len();
                huppermage = consume_runes(huppermage, &consumed_runes);
                huppermage = add_abundance(huppermage, (consumed_count as i32) * 15).state;
            }

            apply_absorption_quadramentale_bq_gain(spell, &huppermage, action, &mut resources);
            apply_extension_des_sens_bq_regeneration(
                spell,
                effective_cost,
                &mut huppermage,
                &mut resources,
            );

            casts_by_spell_id.insert(
                spell.id.clone(),
                casts_by_spell_id.get(&spell.id).copied().unwrap_or(0) + 1,
            );
            if counts_as_soft_target_cast(action) {
                target_casts_by_spell_id.insert(
                    spell.id.clone(),
                    target_casts_by_spell_id
                        .get(&spell.id)
                        .copied()
                        .unwrap_or(0)
                        + 1,
                );
            }
            apply_spell_cooldown(&mut huppermage.cooldowns_by_spell_id, &rules);
            huppermage = add_used_spell_id(huppermage, &rules);
            if let Some(rune) = generated_rune {
                if !generated_rune_was_active {
                    let generation = apply_generated_rune(huppermage, resources, rune);
                    huppermage = generation.state;
                    resources = generation.resources;
                }
            }
            store_sublimation_after_action(candidate, spell, action_damage, &mut sublimation_state);
        }

        let turn_end = apply_turn_end_bq(huppermage, resources);
        huppermage = turn_end.state;
        resources = turn_end.resources;
        let sublimation_resource_carryover =
            collect_sublimation_resource_carryover(candidate, resources);
        if has_passive(&huppermage, "profusion-runique") {
            let active_rune_count = get_active_rune_count(&huppermage);
            if active_rune_count > 0 {
                huppermage = add_abundance(huppermage, (active_rune_count as i32) * 15).state;
            }
        }
        if has_passive(&huppermage, "dynamo") {
            huppermage.runes.active = RuneTracker::default();
        }
        total_damage = round_damage(total_damage + turn_damage);

        if turn_index + 1 < candidate.plan.turns.len() {
            let carried =
                create_next_turn_state(base_resources, resources, huppermage, &casts_by_spell_id);
            resources = carried.resources;
            resources.ap += sublimation_resource_carryover.ap;
            resources.mp += sublimation_resource_carryover.mp;
            huppermage = carried.huppermage;
            sublimation_state.damage_elements_this_turn.clear();
            sublimation_state.spent_resources_this_turn = ResourcePool::default();
        }
    }

    Ok(create_candidate_evaluation_result(
        candidate_id,
        true,
        total_damage,
        resources,
        huppermage,
        Some(create_candidate_score_breakdown(
            total_damage,
            damage_by_resolved_element,
            read_score_criterion(request),
        )),
        None,
    ))
}

pub fn evaluate_candidate_batch(
    request: &OptimizerRequest,
    candidates: &[CandidateEvaluationInput],
) -> Result<Vec<CandidateEvaluationResult>, String> {
    let catalog = read_search_catalog(request)?;
    let spells_by_id = catalog
        .iter()
        .filter(|entry| entry.kind == "spell")
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();

    candidates
        .iter()
        .map(|candidate| {
            evaluate_candidate_with_catalog(
                request,
                &OptimizerCandidateInput {
                    passive_ids: candidate.passive_ids.clone(),
                    sublimation_ids: candidate.sublimation_ids.clone(),
                    plan: candidate.plan.clone(),
                },
                &candidate.id,
                &catalog,
                &spells_by_id,
            )
        })
        .collect()
}

fn create_candidate_evaluation_result(
    candidate_id: &str,
    valid: bool,
    total_damage: f64,
    final_resources: ResourcePool,
    final_huppermage: HuppermageState,
    score: Option<CandidateScoreBreakdown>,
    first_violation: Option<CandidateEvaluationViolation>,
) -> CandidateEvaluationResult {
    CandidateEvaluationResult {
        candidate_id: candidate_id.to_string(),
        valid,
        total_damage,
        final_resources,
        final_huppermage,
        score,
        first_violation,
    }
}

fn create_candidate_score_breakdown(
    total_damage: f64,
    damage_by_resolved_element: DamageByElement,
    criterion: ScoreCriterion,
) -> CandidateScoreBreakdown {
    let score = match criterion {
        ScoreCriterion::TotalDamage => total_damage,
        ScoreCriterion::TargetElementDamage { element } => {
            get_damage_by_element(&damage_by_resolved_element, &element)
        }
    };

    CandidateScoreBreakdown {
        score,
        total_damage,
        damage_by_resolved_element,
    }
}

fn violation_with_turn(
    turn_index: u32,
    violation: &SimulationViolation,
) -> CandidateEvaluationViolation {
    CandidateEvaluationViolation {
        turn_index,
        violation_type: violation.violation_type.clone(),
        action_index: violation.action_index as i32,
        spell_id: violation.spell_id.clone(),
        resource: None,
        required: violation.required.map(f64::from),
        available: violation.available.map(f64::from),
        scope: violation.scope.clone(),
    }
}

fn resource_violation_with_turn(
    turn_index: u32,
    violation: &ResourceViolation,
) -> CandidateEvaluationViolation {
    CandidateEvaluationViolation {
        turn_index,
        violation_type: violation.violation_type.clone(),
        action_index: violation.action_index as i32,
        spell_id: Some(violation.spell_id.clone()),
        resource: Some(violation.resource.clone()),
        required: Some(violation.required),
        available: Some(violation.available),
        scope: None,
    }
}

#[derive(Clone, Debug, Default)]
struct SublimationCombatState {
    elemental_carryover: BTreeMap<Element, f64>,
    damage_elements_this_turn: Vec<Element>,
    alternance_previous_element: Option<Element>,
    spell_count_carryover: BTreeMap<String, SpellCountCarryoverState>,
    spent_resources_this_turn: ResourcePool,
}

#[derive(Clone, Debug, Default)]
struct SpellCountCarryoverState {
    qualified_casts: u32,
    pending_damage_inflicted_percent: f64,
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
pub fn generate_hybrid_candidates_json(request_json: &str) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let result = generate_hybrid_candidates(&request).map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust hybrid candidates: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn run_hybrid_search_json(request_json: &str) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let result = run_hybrid_search(&request).map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust hybrid search response: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn evaluate_candidate_json(
    request_json: &str,
    candidate_json: &str,
    candidate_id: &str,
) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let candidate: OptimizerCandidateInput = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate JSON: {error}")))?;
    let result = evaluate_candidate(&request, &candidate, candidate_id)
        .map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust candidate evaluation: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn evaluate_candidate_batch_json(
    request_json: &str,
    candidates_json: &str,
) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let candidates: Vec<CandidateEvaluationInput> = serde_json::from_str(candidates_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate batch JSON: {error}")))?;
    let result = evaluate_candidate_batch(&request, &candidates)
        .map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust candidate batch evaluation: {error}"
        ))
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

#[wasm_bindgen]
pub fn create_hybrid_schedule_json(request_json: &str) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    serde_json::to_string(&create_hybrid_schedule(&request)).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust hybrid schedule: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn inject_hybrid_immigrants_json(
    request_json: &str,
    population_json: &str,
    restart_index: u32,
) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let population: Vec<HybridPopulationEntry> = serde_json::from_str(population_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid population JSON: {error}")))?;
    let result = inject_hybrid_immigrants(&request, population, restart_index)
        .map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust hybrid immigrants: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn crossover_candidates_json(
    request_json: &str,
    parent_a_json: &str,
    parent_b_json: &str,
    seed: &str,
) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let parent_a: OptimizerCandidateInput = serde_json::from_str(parent_a_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid parent A JSON: {error}")))?;
    let parent_b: OptimizerCandidateInput = serde_json::from_str(parent_b_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid parent B JSON: {error}")))?;
    let mut rng = SeededRandom::new(seed);
    let candidate = crossover_candidates(&request, &parent_a, &parent_b, &mut rng)
        .map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&candidate).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust crossover candidate: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn mutate_candidate_json(
    request_json: &str,
    candidate_json: &str,
    seed: &str,
) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let candidate: OptimizerCandidateInput = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate JSON: {error}")))?;
    let mut rng = SeededRandom::new(seed);
    let candidate = mutate_candidate(&request, &candidate, &mut rng)
        .map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&candidate).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust mutated candidate: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn create_hybrid_repair_candidate_json(
    candidate_json: &str,
    violation_json: &str,
) -> Result<String, JsValue> {
    let candidate: OptimizerCandidateInput = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate JSON: {error}")))?;
    let violation: HybridViolationInput = serde_json::from_str(violation_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid violation JSON: {error}")))?;
    serde_json::to_string(&create_hybrid_repair_candidate(&candidate, &violation)).map_err(
        |error| {
            JsValue::from_str(&format!(
                "Failed to serialize Rust repair candidate: {error}"
            ))
        },
    )
}

#[wasm_bindgen]
pub fn enqueue_hybrid_elite_neighbors_json(
    request_json: &str,
    queue_json: &str,
    candidate_json: &str,
) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    let queue: Vec<OptimizerCandidateInput> = serde_json::from_str(queue_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid queue JSON: {error}")))?;
    let candidate: OptimizerCandidateInput = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate JSON: {error}")))?;
    let result = enqueue_hybrid_elite_neighbors(&request, queue, &candidate)
        .map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&result).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust elite neighbors: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn access_evaluator_cache_json(
    cache_json: &str,
    key: &str,
    value_json: &str,
) -> Result<String, JsValue> {
    let snapshot: EvaluatorCacheSnapshot = serde_json::from_str(cache_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid cache JSON: {error}")))?;
    let value: Value = serde_json::from_str(value_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid evaluation JSON: {error}")))?;
    let mut cache = EvaluatorCache::from_snapshot(snapshot);
    let access = cache.get_or_insert(key.to_string(), value);
    serde_json::to_string(&access).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust evaluator cache access: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn create_evaluation_cache_key_json(
    prefix: &str,
    candidate_json: &str,
) -> Result<String, JsValue> {
    let candidate: OptimizerCandidateInput = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid candidate JSON: {error}")))?;
    Ok(create_evaluation_cache_key(prefix, &candidate))
}

#[wasm_bindgen]
pub fn update_top_candidates_json(
    tracker_json: &str,
    candidate_json: &str,
) -> Result<String, JsValue> {
    let tracker: TopCandidateTrackerSnapshot =
        serde_json::from_str(tracker_json).map_err(|error| {
            JsValue::from_str(&format!("Invalid top-candidate tracker JSON: {error}"))
        })?;
    let candidate: TopCandidateEntry = serde_json::from_str(candidate_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid top candidate JSON: {error}")))?;
    serde_json::to_string(&update_top_candidates(tracker, candidate)).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust top-candidate update: {error}"
        ))
    })
}

#[wasm_bindgen]
pub fn emit_progress_snapshots_json(batch_json: &str) -> Result<String, JsValue> {
    let batch: ProgressBatchInput = serde_json::from_str(batch_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid progress batch JSON: {error}")))?;
    serde_json::to_string(&emit_progress_snapshots(batch)).map_err(|error| {
        JsValue::from_str(&format!(
            "Failed to serialize Rust progress snapshots: {error}"
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
    fn generates_hybrid_candidates_in_deterministic_batches() {
        let mut request = transformation_request();
        request.iterations = 12;
        let first =
            generate_hybrid_candidates(&request).expect("hybrid candidate batch should generate");
        let second = generate_hybrid_candidates(&request)
            .expect("hybrid candidate batch should be deterministic");

        assert!(first.supported);
        assert_eq!(first.backend, "rustWasm");
        assert_eq!(first.attempts, request.iterations);
        assert_eq!(first.candidates.len(), request.iterations as usize);
        assert_eq!(first, second);
        assert_eq!(
            first.metrics.get("rustWasmGeneratedCandidates"),
            Some(&request.iterations)
        );
    }

    #[test]
    fn evaluates_complete_candidates_across_turns() {
        let request = transformation_request();
        let candidate = candidate_from_actions(vec!["hit"], vec![]);
        let evaluation = evaluate_candidate(&request, &candidate, "candidate:hit")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.candidate_id, "candidate:hit");
        assert_eq!(evaluation.total_damage, 40.0);
        assert_eq!(evaluation.final_resources.ap, 5.0);
        assert_eq!(evaluation.final_resources.bq, 300.0);
        assert_eq!(
            evaluation.score,
            Some(CandidateScoreBreakdown {
                score: 40.0,
                total_damage: 40.0,
                damage_by_resolved_element: DamageByElement {
                    fire: 40.0,
                    ..DamageByElement::default()
                },
            })
        );
        assert!(evaluation.first_violation.is_none());
    }

    #[test]
    fn scores_candidate_evaluation_with_target_element_criterion() {
        let mut request = transformation_request();
        request.criterion = Some(serde_json::json!({
            "type": "elementDamage",
            "element": "water"
        }));
        let candidate = candidate_from_actions(vec!["hit"], vec![]);
        let evaluation = evaluate_candidate(&request, &candidate, "candidate:hit")
            .expect("candidate should evaluate");

        assert_eq!(
            evaluation.score,
            Some(CandidateScoreBreakdown {
                score: 0.0,
                total_damage: 40.0,
                damage_by_resolved_element: DamageByElement {
                    fire: 40.0,
                    ..DamageByElement::default()
                },
            })
        );
    }

    #[test]
    fn candidate_evaluation_composes_rune_generation_profusion_and_abundance_damage() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"abundance",
              "duration":2,
              "iterations":10,
              "maxActionsPerTurn":3,
              "maxPassiveCount":1,
              "availableSpellIds":["air-hit","light-hit"],
              "availablePassiveIds":["profusion-runique"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"air-hit",
                  "element":"air",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":50,"element":"air"}],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"light-hit",
                  "element":"light",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":100,"element":"light"}],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"passive",
                  "id":"profusion-runique",
                  "effects":[],
                  "constraints":[],
                  "tags":["passive","abondance"]
                }
              ],
              "character":{
                "id":"test",
                "resources":{"ap":6,"mp":3,"wp":2,"bq":100},
                "stats":{"damageInflictedPercent":20}
              }
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec!["profusion-runique".to_string()],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![action("air-hit")],
                    },
                    CandidateTurn {
                        actions: vec![action("light-hit")],
                    },
                ],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:abundance")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.total_damage, 195.0);
        assert_eq!(
            evaluation.score,
            Some(CandidateScoreBreakdown {
                score: 195.0,
                total_damage: 195.0,
                damage_by_resolved_element: DamageByElement {
                    air: 60.0,
                    fire: 135.0,
                    ..DamageByElement::default()
                },
            })
        );
        assert_eq!(evaluation.final_huppermage.abundance_level, 15);
    }

    #[test]
    fn candidate_evaluation_applies_halo_chatoyant_mark_triggers() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"halo",
              "duration":2,
              "iterations":10,
              "maxActionsPerTurn":3,
              "maxPassiveCount":0,
              "availableSpellIds":["halo-chatoyant","air-rune"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"halo-chatoyant",
                  "element":"light",
                  "cost":{"ap":1},
                  "effects":[
                    {
                      "type":"conditional",
                      "condition":{"type":"hasRune","rune":"aerial"},
                      "effects":[
                        {"type":"tag","tag":"triggerMarkImmediately","value":true},
                        {"type":"tag","tag":"consumeRune","value":"aerial"}
                      ]
                    }
                  ],
                  "constraints":[{"type":"requiresTarget","target":"emptyCell"}],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"air-rune",
                  "element":"air",
                  "cost":{"ap":1},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec![],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![empty_cell_action("halo-chatoyant"), action("air-rune")],
                    },
                    CandidateTurn {
                        actions: vec![empty_cell_action("halo-chatoyant")],
                    },
                ],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:halo")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.total_damage, 162.0);
        assert_eq!(evaluation.final_huppermage.halo_chatoyant_marks, 0);
        assert!(!evaluation.final_huppermage.runes.active.aerial);
        assert_eq!(evaluation.final_huppermage.abundance_level, 15);
        assert_eq!(
            evaluation.score,
            Some(CandidateScoreBreakdown {
                score: 162.0,
                total_damage: 162.0,
                damage_by_resolved_element: DamageByElement {
                    fire: 162.0,
                    ..DamageByElement::default()
                },
            })
        );
    }

    #[test]
    fn candidate_evaluation_applies_delayed_damage_from_consumed_rune() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"delayed-damage",
              "duration":2,
              "iterations":10,
              "maxActionsPerTurn":2,
              "maxPassiveCount":0,
              "availableSpellIds":["fire-rune","lueur-de-laube"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"fire-rune",
                  "element":"fire",
                  "cost":{"ap":1},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"lueur-de-laube",
                  "element":"fire",
                  "cost":{"ap":1},
                  "effects":[
                    {"type":"damage","base":54,"element":"fire"},
                    {
                      "type":"conditional",
                      "condition":{"type":"hasRune","rune":"incandescent"},
                      "effects":[
                        {"type":"tag","tag":"delayedDamagePercentOfActionDamage","value":10},
                        {"type":"tag","tag":"consumeRune","value":"incandescent"}
                      ]
                    }
                  ],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec![],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![action("fire-rune")],
                    },
                    CandidateTurn {
                        actions: vec![action("lueur-de-laube")],
                    },
                ],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:delayed")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.total_damage, 71.28);
        assert!(!evaluation.final_huppermage.runes.active.incandescent);
        assert_eq!(evaluation.final_huppermage.abundance_level, 15);
        assert_eq!(
            evaluation.score,
            Some(CandidateScoreBreakdown {
                score: 71.28,
                total_damage: 71.28,
                damage_by_resolved_element: DamageByElement {
                    fire: 71.28,
                    ..DamageByElement::default()
                },
            })
        );
    }

    #[test]
    fn candidate_evaluation_applies_antithese_per_elemental_spell() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"antithese-candidate",
              "duration":1,
              "iterations":10,
              "maxActionsPerTurn":2,
              "maxPassiveCount":1,
              "availableSpellIds":["fire-hit","water-hit"],
              "availablePassiveIds":["antithese"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"fire-hit",
                  "element":"fire",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":10,"element":"fire"}],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"water-hit",
                  "element":"water",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":10,"element":"water"}],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"passive",
                  "id":"antithese",
                  "effects":[
                    {"type":"statModifier","stat":"damageInflictedPercent","amount":-10},
                    {
                      "type":"trigger",
                      "event":"runeGenerated",
                      "effects":[{"type":"resourceDelta","resource":"bq","amount":20}]
                    }
                  ],
                  "constraints":[],
                  "tags":["passive"]
                }
              ],
              "character":{
                "id":"test",
                "resources":{"ap":6,"mp":3,"wp":2,"bq":100},
                "stats":{"damageInflictedPercent":20}
              }
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec!["antithese".to_string()],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![CandidateTurn {
                    actions: vec![action("fire-hit"), action("water-hit")],
                }],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:antithese")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.total_damage, 19.0);
        assert_eq!(evaluation.final_resources.bq, 240.0);
        assert_eq!(
            evaluation.score,
            Some(CandidateScoreBreakdown {
                score: 19.0,
                total_damage: 19.0,
                damage_by_resolved_element: DamageByElement {
                    fire: 10.0,
                    water: 9.0,
                    ..DamageByElement::default()
                },
            })
        );
    }

    #[test]
    fn candidate_evaluation_applies_absorption_quadramentale_removal_bq_gain() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"absorption-removal",
              "duration":1,
              "iterations":10,
              "maxActionsPerTurn":1,
              "maxPassiveCount":1,
              "availableSpellIds":["removal"],
              "availablePassiveIds":["absorption-quadramentale"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"removal",
                  "element":"earth",
                  "cost":{},
                  "effects":[
                    {"type":"resourceDelta","resource":"ap","amount":-1,"target":"target"},
                    {"type":"statModifier","stat":"range","amount":-1,"target":"target"}
                  ],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"passive",
                  "id":"absorption-quadramentale",
                  "effects":[],
                  "constraints":[],
                  "tags":["passive"]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec!["absorption-quadramentale".to_string()],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![CandidateTurn {
                    actions: vec![action("removal")],
                }],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:absorption-removal")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.final_resources.bq, 240.0);
    }

    #[test]
    fn candidate_evaluation_ignores_event_trigger_effects_without_event() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"trigger-resource",
              "duration":1,
              "iterations":10,
              "maxActionsPerTurn":1,
              "maxPassiveCount":0,
              "availableSpellIds":["trigger-spell"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"trigger-spell",
                  "cost":{"ap":1},
                  "effects":[
                    {
                      "type":"trigger",
                      "event":"later",
                      "effects":[{"type":"resourceDelta","resource":"bq","amount":-50}]
                    }
                  ],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec![],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![CandidateTurn {
                    actions: vec![action("trigger-spell")],
                }],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:trigger")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.final_resources.bq, 200.0);
    }

    #[test]
    fn candidate_evaluation_applies_last_rune_cost_delta() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"last-rune-cost",
              "duration":2,
              "iterations":10,
              "maxActionsPerTurn":1,
              "maxPassiveCount":0,
              "availableSpellIds":["water-rune","discounted-light"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"water-rune",
                  "element":"water",
                  "cost":{},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"discounted-light",
                  "element":"light",
                  "cost":{"ap":6},
                  "effects":[
                    {
                      "type":"conditional",
                      "condition":{"type":"lastRune","rune":"aquatic"},
                      "effects":[{"type":"tag","tag":"costDelta","value":"ap:-1"}]
                    }
                  ],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":5,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec![],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![action("water-rune")],
                    },
                    CandidateTurn {
                        actions: vec![action("discounted-light")],
                    },
                ],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:last-rune-cost")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.final_resources.ap, 0.0);
    }

    #[test]
    fn candidate_evaluation_applies_increasing_bq_cost_per_use_this_turn() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"ramping-bq-cost",
              "duration":1,
              "iterations":10,
              "maxActionsPerTurn":2,
              "maxPassiveCount":0,
              "availableSpellIds":["ramping-spell"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"ramping-spell",
                  "cost":{},
                  "effects":[
                    {"type":"tag","tag":"increasingBqCostPerUseThisTurn","value":50}
                  ],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":40}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec![],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![CandidateTurn {
                    actions: vec![action("ramping-spell"), action("ramping-spell")],
                }],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:ramping-bq-cost")
            .expect("candidate should evaluate");

        assert!(!evaluation.valid);
        assert_eq!(
            evaluation.first_violation.as_ref().map(|violation| (
                violation.action_index,
                violation.resource.as_deref(),
                violation.required,
                violation.available,
            )),
            Some((1, Some("bq"), Some(50.0), Some(40.0)))
        );
    }

    #[test]
    fn evaluates_candidate_batches_in_one_call() {
        let request = transformation_request();
        let candidates = vec![
            CandidateEvaluationInput {
                id: "valid".to_string(),
                passive_ids: vec![],
                sublimation_ids: vec![],
                plan: candidate_from_actions(vec!["hit"], vec![]).plan,
            },
            CandidateEvaluationInput {
                id: "invalid".to_string(),
                passive_ids: vec![],
                sublimation_ids: vec![],
                plan: CandidatePlan {
                    turns: vec![CandidateTurn {
                        actions: vec![action("missing")],
                    }],
                },
            },
        ];

        let batch = evaluate_candidate_batch(&request, &candidates)
            .expect("candidate batch should evaluate");

        assert_eq!(batch.len(), 2);
        assert!(batch[0].valid);
        assert!(!batch[1].valid);
        assert_eq!(
            batch[1]
                .first_violation
                .as_ref()
                .map(|violation| violation.violation_type.as_str()),
            Some("unknownSpell")
        );
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
            "passive-a+passive-z::::ray@emptyCell,hit|"
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
    fn schedules_hybrid_islands_with_deterministic_seeds() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"schedule",
              "duration":3,
              "iterations":1000,
              "maxActionsPerTurn":8,
              "maxPassiveCount":3,
              "catalog":[],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");

        let schedule = create_hybrid_schedule(&request);

        assert_eq!(schedule.island_count, 6);
        assert_eq!(
            schedule
                .islands
                .iter()
                .map(|island| island.iterations)
                .sum::<u32>(),
            1000
        );
        assert_eq!(schedule.islands[0].iterations, 167);
        assert_eq!(schedule.islands[0].rng_seed, "schedule:hybrid:island:0");
        assert_eq!(
            schedule.islands[0].sampler_seed,
            "schedule:hybrid:sampler:0"
        );
        assert_eq!(schedule.islands[0].population_size, 24);
        assert_eq!(schedule.islands[0].stagnation_limit, 48);
    }

    #[test]
    fn ranks_population_and_injects_restart_immigrants() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"restart",
              "duration":3,
              "iterations":200,
              "maxActionsPerTurn":4,
              "maxPassiveCount":0,
              "availableSpellIds":["hit"],
              "availablePassiveIds":[],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"hit",
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":20,"element":"fire"}],
                  "constraints":[],
                  "tags":[]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let low = population_entry("low", 10.0, 3);
        let best = population_entry("best", 20.0, 2);
        let tie_with_more_actions = population_entry("tie", 20.0, 4);

        let restart = inject_hybrid_immigrants(&request, vec![low, tie_with_more_actions, best], 0)
            .expect("immigrants should inject");

        assert_eq!(restart.retained_elites[0].id, "best");
        assert_eq!(restart.retained_elites[1].id, "tie");
        assert_eq!(restart.retained_elites[2].id, "low");
        assert_eq!(restart.immigrants.len(), 7);
        assert_eq!(restart.next_population.len(), 10);
        assert_eq!(restart.metrics.get("hybridRestarts"), Some(&1));
        assert_eq!(restart.metrics.get("hybridImmigrants"), Some(&7));
        assert_eq!(restart.attempts_since_improvement, 28);
    }

    fn population_entry(id: &str, score: f64, action_count: usize) -> HybridPopulationEntry {
        HybridPopulationEntry {
            id: id.to_string(),
            candidate: OptimizerCandidateInput {
                passive_ids: vec![],
                sublimation_ids: vec![],
                plan: CandidatePlan {
                    turns: vec![CandidateTurn {
                        actions: (0..action_count)
                            .map(|index| CandidateAction {
                                spell_id: format!("hit-{index}"),
                                target: None,
                                context: None,
                            })
                            .collect(),
                    }],
                },
            },
            score,
            valid: true,
        }
    }

    #[test]
    fn crossovers_mutates_and_refines_candidates() {
        let request = transformation_request();
        let parent_a = candidate_from_actions(vec!["hit", "cell"], vec!["passive-a"]);
        let parent_b = candidate_from_actions(vec!["burst", "hit"], vec!["passive-b"]);
        let mut rng = SeededRandom::new("transform");

        let crossover = crossover_candidates(&request, &parent_a, &parent_b, &mut rng)
            .expect("crossover should produce candidate");
        assert_eq!(crossover.plan.turns.len(), parent_a.plan.turns.len());
        assert!(crossover.passive_ids.len() <= request.max_passive_count as usize);

        let mutated = mutate_candidate(&request, &parent_a, &mut rng)
            .expect("mutation should produce candidate");
        assert_eq!(mutated.plan.turns.len(), parent_a.plan.turns.len());
        assert!(mutated
            .plan
            .turns
            .iter()
            .all(|turn| !turn.actions.is_empty()
                && turn.actions.len() <= request.max_actions_per_turn as usize));

        let refined = create_hybrid_local_refinement(
            &request,
            vec![
                HybridPopulationEntry {
                    id: "a".to_string(),
                    candidate: parent_a,
                    score: 10.0,
                    valid: true,
                },
                HybridPopulationEntry {
                    id: "b".to_string(),
                    candidate: parent_b,
                    score: 20.0,
                    valid: true,
                },
            ],
            &mut rng,
        )
        .expect("local refinement should produce candidate");
        assert_eq!(refined.plan.turns.len(), request.duration as usize);
    }

    #[test]
    fn repairs_and_deduplicates_repair_queue_candidates() {
        let request = transformation_request();
        let candidate = OptimizerCandidateInput {
            passive_ids: vec![],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![action("hit"), action("burst"), action("cell")],
                    },
                    CandidateTurn {
                        actions: vec![action("hit")],
                    },
                ],
            },
        };
        let violation = HybridViolationInput {
            violation_type: "insufficientResource".to_string(),
            turn_index: 0,
            action_index: 1,
        };

        let repair = create_hybrid_repair_candidate(&candidate, &violation)
            .expect("repair should remove invalid suffix");
        assert_eq!(repair.plan.turns[0].actions.len(), 1);

        let first = enqueue_hybrid_repair_candidate(&request, vec![], Some(repair.clone()));
        assert!(first.enqueued);
        assert_eq!(first.queue.len(), 1);
        assert_eq!(first.metrics.get("hybridRepairQueueCandidates"), Some(&1));

        let duplicate = enqueue_hybrid_repair_candidate(&request, first.queue, Some(repair));
        assert!(!duplicate.enqueued);
        assert_eq!(duplicate.queue.len(), 1);
    }

    #[test]
    fn generates_elite_neighbors_with_metrics() {
        let request = transformation_request();
        let candidate = OptimizerCandidateInput {
            passive_ids: vec!["passive-a".to_string()],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![action("hit"), action("burst")],
                    },
                    CandidateTurn {
                        actions: vec![action("cell")],
                    },
                ],
            },
        };

        let result = enqueue_hybrid_elite_neighbors(&request, vec![], &candidate)
            .expect("neighbors should generate");

        assert!(result.generated > 0);
        assert_eq!(result.queue.len(), result.generated as usize);
        assert!(result.metrics.values().any(|value| *value > 0));
        assert!(result
            .queue
            .iter()
            .all(|neighbor| neighbor.plan.turns.len() == candidate.plan.turns.len()));
    }

    #[test]
    fn runs_hybrid_search_and_returns_scored_top_candidates() {
        let mut request = transformation_request();
        request.iterations = 100;
        request.max_candidates = Some(3);

        let result = run_hybrid_search(&request).expect("hybrid search should run");

        assert!(result.supported);
        assert_eq!(result.attempts, 100);
        assert_eq!(result.valid_candidates + result.invalid_candidates, 100);
        assert!(!result.top_candidates.is_empty());
        assert!(result.top_candidates.len() <= 3);
        assert!(result
            .top_candidates
            .windows(2)
            .all(|pair| compare_scored_top_candidates(&pair[0], &pair[1])
                != std::cmp::Ordering::Greater));
        assert_eq!(
            result.metrics.get("rustWasmCandidateEvaluations"),
            Some(&100)
        );
        assert_eq!(result.metrics.get("hybridIslands"), Some(&1));
        assert!(result.metrics.contains_key("hybridEliteCount"));
        assert!(result.metrics.contains_key("cacheHits"));
        assert!(result.metrics.contains_key("cacheMisses"));
        let resume_state = result
            .resume_state
            .clone()
            .expect("hybrid search should return resume state");
        assert_eq!(resume_state.total_attempts, 100);
        assert_eq!(resume_state.islands.len(), 1);

        let mut resumed_request = request.clone();
        resumed_request.resume_state = Some(resume_state);
        let resumed_result =
            run_hybrid_search(&resumed_request).expect("resumed hybrid search should run");
        assert_eq!(resumed_result.attempts, 100);
        assert_eq!(
            resumed_result
                .resume_state
                .expect("resumed search should return resume state")
                .total_attempts,
            200
        );
    }

    #[test]
    fn caches_evaluations_with_lru_metrics() {
        let candidate = candidate_from_actions(vec!["hit"], vec!["passive-a"]);
        assert_eq!(
            create_evaluation_cache_key("prefix::", &candidate),
            "prefix::passive-a::::hit|hit"
        );

        let mut cache = EvaluatorCache::new(2);
        let first = cache.get_or_insert("a".to_string(), serde_json::json!({"score":1}));
        assert!(!first.hit);
        assert_eq!(first.cache.metrics.cache_misses, 1);

        let second = EvaluatorCache::from_snapshot(first.cache)
            .get_or_insert("b".to_string(), serde_json::json!({"score":2}));
        assert!(!second.hit);
        assert_eq!(
            second
                .cache
                .entries
                .iter()
                .map(|entry| entry.key.as_str())
                .collect::<Vec<_>>(),
            vec!["a", "b"]
        );

        let hit = EvaluatorCache::from_snapshot(second.cache)
            .get_or_insert("a".to_string(), serde_json::json!({"score":99}));
        assert!(hit.hit);
        assert_eq!(hit.value, serde_json::json!({"score":1}));
        assert_eq!(
            hit.cache
                .entries
                .iter()
                .map(|entry| entry.key.as_str())
                .collect::<Vec<_>>(),
            vec!["b", "a"]
        );

        let evicted = EvaluatorCache::from_snapshot(hit.cache)
            .get_or_insert("c".to_string(), serde_json::json!({"score":3}));
        assert_eq!(
            evicted
                .cache
                .entries
                .iter()
                .map(|entry| entry.key.as_str())
                .collect::<Vec<_>>(),
            vec!["a", "c"]
        );
        assert_eq!(evicted.cache.metrics.cache_hits, 1);
        assert_eq!(evicted.cache.metrics.cache_misses, 3);
        assert_eq!(evicted.cache.metrics.cache_evictions, 1);
    }

    #[test]
    fn tracks_top_candidates_with_deterministic_tie_breaking() {
        let tracker = TopCandidateTrackerSnapshot {
            max_candidates: 3,
            candidates: vec![],
        };

        let update =
            update_top_candidates(tracker, top_candidate("heavy", 10.0, vec!["passive-a"], 3));
        assert!(update.accepted);
        let update = update_top_candidates(update.tracker, top_candidate("lean", 10.0, vec![], 2));
        assert_eq!(
            update
                .best_candidate
                .as_ref()
                .map(|entry| entry.id.as_str()),
            Some("lean")
        );
        let update = update_top_candidates(update.tracker, top_candidate("alpha", 10.0, vec![], 2));
        assert_eq!(
            update
                .tracker
                .candidates
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha", "lean", "heavy"]
        );

        let rejected = update_top_candidates(
            update.tracker.clone(),
            top_candidate("weak", 1.0, vec![], 1),
        );
        assert!(!rejected.accepted);
        assert_eq!(rejected.tracker.candidates.len(), 3);

        let evicted =
            update_top_candidates(rejected.tracker, top_candidate("winner", 20.0, vec![], 1));
        assert!(evicted.accepted);
        assert_eq!(evicted.removed_id.as_deref(), Some("heavy"));
        assert_eq!(
            evicted
                .tracker
                .candidates
                .iter()
                .map(|entry| entry.id.as_str())
                .collect::<Vec<_>>(),
            vec!["winner", "alpha", "lean"]
        );

        let replacement =
            update_top_candidates(evicted.tracker, top_candidate("lean", 30.0, vec![], 2));
        assert!(replacement.accepted);
        assert_eq!(
            replacement
                .best_candidate
                .as_ref()
                .map(|entry| entry.id.as_str()),
            Some("lean")
        );
        assert_eq!(
            replacement
                .tracker
                .candidates
                .iter()
                .filter(|entry| entry.id == "lean")
                .count(),
            1
        );
    }

    fn top_candidate(
        id: &str,
        score: f64,
        passive_ids: Vec<&str>,
        action_count: usize,
    ) -> TopCandidateEntry {
        TopCandidateEntry {
            id: id.to_string(),
            candidate: OptimizerCandidateInput {
                passive_ids: passive_ids.into_iter().map(str::to_string).collect(),
                sublimation_ids: vec![],
                plan: CandidatePlan {
                    turns: vec![CandidateTurn {
                        actions: (0..action_count)
                            .map(|index| CandidateAction {
                                spell_id: format!("hit-{index}"),
                                target: None,
                                context: None,
                            })
                            .collect(),
                    }],
                },
            },
            score,
        }
    }

    #[test]
    fn emits_progress_snapshots_at_interval_best_change_and_final() {
        let snapshots = emit_progress_snapshots(ProgressBatchInput {
            engine: "hybrid".to_string(),
            progress_interval: 3,
            top_candidates: vec![top_candidate("best", 99.0, vec![], 1)],
            checkpoints: vec![
                checkpoint(1, false),
                checkpoint(2, true),
                checkpoint(3, false),
                checkpoint(4, false),
                checkpoint(5, false),
            ],
            include_final: true,
        });

        assert_eq!(
            snapshots
                .iter()
                .map(|snapshot| snapshot.attempts)
                .collect::<Vec<_>>(),
            vec![2, 3, 5]
        );
        assert_eq!(snapshots[0].engine, "hybrid");
        assert_eq!(snapshots[0].top_candidates[0].id, "best");
        assert_eq!(snapshots[0].metrics.get("cacheHits"), Some(&2.0));
    }

    fn checkpoint(attempts: u32, best_changed: bool) -> ProgressCheckpoint {
        ProgressCheckpoint {
            attempts,
            valid_candidates: attempts.saturating_sub(1),
            invalid_candidates: 1,
            best_score: Some(attempts as f64),
            best_changed,
            metrics: BTreeMap::from([("cacheHits".to_string(), attempts as f64)]),
        }
    }

    fn transformation_request() -> OptimizerRequest {
        parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"transform",
              "duration":2,
              "iterations":200,
              "maxActionsPerTurn":4,
              "maxPassiveCount":2,
              "availableSpellIds":["burst","cell","hit"],
              "availablePassiveIds":["passive-a","passive-b"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"burst",
                  "cost":{"ap":3},
                  "effects":[{"type":"damage","base":50,"element":"fire"}],
                  "constraints":[],
                  "tags":["burst"]
                },
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
                  "cost":{"ap":1},
                  "effects":[{"type":"damage","base":20,"element":"fire"}],
                  "constraints":[],
                  "tags":[]
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
                  "id":"passive-b",
                  "effects":[],
                  "constraints":[],
                  "tags":["bq"]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse")
    }

    fn candidate_from_actions(
        spell_ids: Vec<&str>,
        passive_ids: Vec<&str>,
    ) -> OptimizerCandidateInput {
        OptimizerCandidateInput {
            passive_ids: passive_ids.into_iter().map(str::to_string).collect(),
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: spell_ids.into_iter().map(action).collect(),
                    },
                    CandidateTurn {
                        actions: vec![action("hit")],
                    },
                ],
            },
        }
    }

    fn action(spell_id: &str) -> CandidateAction {
        CandidateAction {
            spell_id: spell_id.to_string(),
            target: if spell_id == "cell" {
                Some(CandidateActionTarget {
                    kind: ActionTargetKind::EmptyCell,
                })
            } else {
                None
            },
            context: None,
        }
    }

    fn empty_cell_action(spell_id: &str) -> CandidateAction {
        CandidateAction {
            spell_id: spell_id.to_string(),
            target: Some(CandidateActionTarget {
                kind: ActionTargetKind::EmptyCell,
            }),
            context: None,
        }
    }

    #[test]
    fn validates_and_pays_resource_costs() {
        let result = validate_resource_cost(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                critical_mode: None,
                is_berserk: None,
                is_blocked: None,
            }),
        );

        assert!(result.valid);
        assert_eq!(
            result.resources_after_cost,
            ResourcePool {
                ap: 9.0,
                mp: 5.0,
                wp: 6.0,
                bq: 425.0
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
                ap: 2.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 2.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0
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
                required: 3.0,
                available: 2.0,
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
                critical_mode: None,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            vec![],
        );
        let first = apply_generated_rune(
            state,
            ResourcePool {
                ap: 8.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            Rune::Incandescent,
        );

        assert!(first.generated);
        assert!(first.granted_ap);
        assert_eq!(first.resources.ap, 9.0);
        assert!(first.state.runes.active.incandescent);
        assert_eq!(
            first.state.runes.last_generated_rune,
            Some(Rune::Incandescent)
        );

        let second = apply_generated_rune(first.state, first.resources, Rune::Incandescent);
        assert!(!second.generated);
        assert_eq!(second.resources.ap, 9.0);
    }

    #[test]
    fn applies_antithese_and_bq_gain_multipliers_on_rune_generation() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 8.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            Rune::Aerial,
        );

        assert_eq!(result.antithese_bq_gain, 40);
        assert_eq!(result.resources.bq, 540.0);
    }

    #[test]
    fn caps_abundance_with_combinaison_elementaire() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            vec![],
        );
        state.runes.last_generated_rune = Some(Rune::Aquatic);

        let state = apply_coeur_de_lumiere(state).expect("heart should activate");

        assert_eq!(state.active_heart, Some(HuppermageHeart::Water));
    }

    #[test]
    fn candidate_evaluation_applies_extension_des_sens_earth_heart_bq_regeneration() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"extension-earth",
              "duration":1,
              "iterations":10,
              "maxActionsPerTurn":3,
              "maxPassiveCount":1,
              "availableSpellIds":["earth-rune","coeur-de-lumiere","ap-spell"],
              "availablePassiveIds":["extension-des-sens"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"earth-rune",
                  "element":"earth",
                  "cost":{},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"coeur-de-lumiere",
                  "cost":{},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"ap-spell",
                  "cost":{"ap":2},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"passive",
                  "id":"extension-des-sens",
                  "effects":[],
                  "constraints":[],
                  "tags":["passive"]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec!["extension-des-sens".to_string()],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![CandidateTurn {
                    actions: vec![
                        action("earth-rune"),
                        action("coeur-de-lumiere"),
                        action("ap-spell"),
                    ],
                }],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:extension-earth")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.final_resources.bq, 140.0);
        assert_eq!(evaluation.final_huppermage.stored_bq, 75);
    }

    #[test]
    fn candidate_evaluation_applies_initiative_de_lame_first_spell_heart_ap_gain() {
        let request = parse_optimizer_request(
            r#"{
              "schemaVersion":1,
              "engine":"hybrid",
              "seed":"initiative-heart",
              "duration":2,
              "iterations":10,
              "maxActionsPerTurn":1,
              "maxPassiveCount":1,
              "availableSpellIds":["earth-rune","coeur-de-lumiere"],
              "availablePassiveIds":["initiative-de-lame"],
              "catalog":[
                {
                  "kind":"spell",
                  "id":"earth-rune",
                  "element":"earth",
                  "cost":{},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"spell",
                  "id":"coeur-de-lumiere",
                  "cost":{},
                  "effects":[],
                  "constraints":[],
                  "tags":[]
                },
                {
                  "kind":"passive",
                  "id":"initiative-de-lame",
                  "effects":[],
                  "constraints":[],
                  "tags":["passive"]
                }
              ],
              "character":{"id":"test","resources":{"ap":6,"mp":3,"wp":2,"bq":100}}
            }"#,
        )
        .expect("request should parse");
        let candidate = OptimizerCandidateInput {
            passive_ids: vec!["initiative-de-lame".to_string()],
            sublimation_ids: vec![],
            plan: CandidatePlan {
                turns: vec![
                    CandidateTurn {
                        actions: vec![action("earth-rune")],
                    },
                    CandidateTurn {
                        actions: vec![action("coeur-de-lumiere")],
                    },
                ],
            },
        };

        let evaluation = evaluate_candidate(&request, &candidate, "candidate:initiative-heart")
            .expect("candidate should evaluate");

        assert!(evaluation.valid);
        assert_eq!(evaluation.final_resources.ap, 8.0);
        assert_eq!(
            evaluation.final_huppermage.active_heart,
            Some(HuppermageHeart::Earth)
        );
    }

    #[test]
    fn cycle_elementaire_restores_opposite_active_last_rune() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            vec!["combinaison-elementaire".to_string()],
        );
        state.runes.last_generated_rune = Some(Rune::Incandescent);
        state.runes.active.incandescent = true;

        let result = apply_cycle_elementaire(
            state,
            ResourcePool {
                ap: 8.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            vec![],
        );
        state.active_heart = Some(HuppermageHeart::Fire);

        let stored = apply_turn_end_bq(
            state,
            ResourcePool {
                ap: 0.0,
                mp: 0.0,
                wp: 6.0,
                bq: 300.0,
            },
        );
        assert_eq!(stored.amount, 0);
        assert_eq!(stored.stored_after, 75);
        assert_eq!(stored.resources.bq, 300.0);

        let mut next_state = stored.state;
        next_state.active_heart = None;
        let regenerated = apply_turn_end_bq(next_state, stored.resources);
        assert_eq!(regenerated.amount, 175);
        assert_eq!(regenerated.resources.bq, 475.0);
        assert_eq!(regenerated.stored_after, 0);
    }

    #[test]
    fn converts_wp_to_initial_bq() {
        let converted = convert_wp_to_bq(ResourcePool {
            ap: 12.0,
            mp: 6.0,
            wp: 6.0,
            bq: 100.0,
        });

        assert_eq!(converted.bq, 550.0);
        assert_eq!(converted.wp, 6.0);
    }

    #[test]
    fn applies_initial_passive_resource_and_stat_modifiers() {
        let result = apply_initial_passive_effects(
            BaseStats::default(),
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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

        assert_eq!(result.resources.ap, 13.0);
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 0.0,
                mp: 0.0,
                wp: 6.0,
                bq: 100.0,
            },
        );

        assert_eq!(turn_end.amount, 160);
        assert_eq!(turn_end.resources.bq, 260.0);
    }

    #[test]
    fn applies_universalite_turn_end_bq_cost_per_active_rune() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            vec!["universalite".to_string()],
        );
        state.runes.active = RuneTracker {
            incandescent: true,
            aquatic: false,
            telluric: true,
            aerial: false,
        };

        let turn_end = apply_turn_end_bq(
            state,
            ResourcePool {
                ap: 0.0,
                mp: 0.0,
                wp: 6.0,
                bq: 20.0,
            },
        );

        assert_eq!(turn_end.amount, 100);
        assert_eq!(turn_end.resources.bq, 20.0);
    }

    #[test]
    fn validates_cooldowns_and_ages_them_between_turns() {
        let mut state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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

        assert!(validate_spell_rules(
            &spell,
            1,
            Some(ActionTargetKind::EmptyCell),
            &BTreeMap::new(),
            &target_casts,
            &state
        )
        .is_none());

        assert!(validate_spell_rules(&spell, 1, None, &casts, &BTreeMap::new(), &state).is_none());

        let turn_limited_spell = SpellRules {
            id: "turn-limited".to_string(),
            element: Some(Element::Fire),
            is_deck_tracked: false,
            max_casts_per_turn: Some(2),
            max_casts_per_target: None,
            cooldown_turns: None,
            required_target: None,
        };
        let mut turn_limited_casts = BTreeMap::new();
        turn_limited_casts.insert("turn-limited".to_string(), 2);
        let turn_violation = validate_spell_rules(
            &turn_limited_spell,
            1,
            None,
            &turn_limited_casts,
            &BTreeMap::new(),
            &state,
        )
        .expect("turn limit should block");
        assert_eq!(turn_violation.scope, Some("turn".to_string()));

        let refraction_state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            vec!["refraction-elementaire".to_string()],
        );
        let coeur = SpellRules {
            id: "coeur-de-lumiere".to_string(),
            element: None,
            is_deck_tracked: false,
            max_casts_per_turn: Some(1),
            max_casts_per_target: None,
            cooldown_turns: None,
            required_target: None,
        };
        let mut coeur_casts = BTreeMap::new();
        coeur_casts.insert("coeur-de-lumiere".to_string(), 1);
        assert!(validate_spell_rules(
            &coeur,
            1,
            None,
            &coeur_casts,
            &BTreeMap::new(),
            &refraction_state
        )
        .is_none());
    }

    #[test]
    fn validates_required_targets() {
        let state = create_huppermage_state(
            ResourcePool {
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            ResourcePool {
                ap: 0.0,
                mp: 1.0,
                wp: 4.0,
                bq: 725.0,
            },
            state,
            &casts,
        );

        assert_eq!(next.resources.ap, 12.0);
        assert_eq!(next.resources.mp, 6.0);
        assert_eq!(next.resources.wp, 4.0);
        assert_eq!(next.resources.bq, 725.0);
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            ResourcePool {
                ap: 0.0,
                mp: 0.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            final_resources: ResourcePool {
                ap: 0.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
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
                ap: 12.0,
                mp: 6.0,
                wp: 6.0,
                bq: 500.0,
            },
            final_resources: ResourcePool {
                ap: 0.0,
                mp: 6.0,
                wp: 4.0,
                bq: 600.0,
            },
        };
        let replay = SimulationSummary {
            valid: true,
            total_damage: 100.0,
            damage_by_resolved_element: DamageByElement::default(),
            initial_resources: first.final_resources,
            final_resources: ResourcePool {
                ap: 0.0,
                mp: 6.0,
                wp: 4.0,
                bq: 600.0,
            },
        };

        let sustainable = evaluate_sustainability(true, &first, &replay);
        assert!(sustainable.sustainable);

        let failing_replay = SimulationSummary {
            final_resources: ResourcePool {
                ap: 0.0,
                mp: 6.0,
                wp: 3.0,
                bq: 600.0,
            },
            ..replay
        };
        let unsustainable = evaluate_sustainability(true, &first, &failing_replay);
        assert!(!unsustainable.sustainable);

        let optional = evaluate_sustainability(false, &first, &failing_replay);
        assert!(optional.sustainable);
    }
}
