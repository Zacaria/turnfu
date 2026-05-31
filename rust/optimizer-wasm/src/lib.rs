use serde::{Deserialize, Serialize};
use serde_json::Value;
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

pub fn parse_optimizer_request(request_json: &str) -> Result<OptimizerRequest, serde_json::Error> {
    serde_json::from_str(request_json)
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
    let mastery_multiplier = 1.0 + (stats.general_mastery + elemental_mastery + extra_mastery) / 100.0;
    let critical_multiplier = if resolved_context.is_critical { 1.25 } else { 1.0 };
    let position_multiplier = get_position_multiplier(&resolved_context.position);
    let final_multiplier = 1.0 + stats.damage_inflicted_percent / 100.0;
    let block_multiplier = if resolved_context.is_blocked { 0.8 } else { 1.0 };
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
            if current.1 > best.1 { current } else { best }
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
        + if context.is_berserk { stats.berserk_mastery } else { 0.0 }
        + if context.position == AttackPosition::Rear { stats.rear_mastery } else { 0.0 }
        + if context.is_critical { stats.critical_mastery } else { 0.0 }
}

fn get_position_multiplier(position: &AttackPosition) -> f64 {
    match position {
        AttackPosition::Rear => 1.25,
        AttackPosition::Side => 1.1,
        AttackPosition::Face => 1.0,
    }
}

fn first_insufficient_resource(resources: ResourcePool, cost: SpellCost) -> Option<(&'static str, i32, i32)> {
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
        Some(json) => Some(serde_json::from_str(&json)
            .map_err(|error| JsValue::from_str(&format!("Invalid action context JSON: {error}")))?),
        None => None,
    };

    serde_json::to_string(&validate_resource_cost(resources, cost, spell_id, action_index, context))
        .map_err(|error| JsValue::from_str(&format!("Failed to serialize resource validation: {error}")))
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
            request_catalog_entries: request.catalog.as_array().map(|entries| entries.len() as u32).unwrap_or(0),
            request_available_spells: request.available_spell_ids.len() as u32,
            request_available_passives: request.available_passive_ids.len() as u32,
        },
    }
}

#[wasm_bindgen]
pub fn inspect_optimizer_request_json(request_json: &str) -> Result<String, JsValue> {
    let request = parse_optimizer_request(request_json)
        .map_err(|error| JsValue::from_str(&format!("Invalid optimizer request JSON: {error}")))?;
    serde_json::to_string(&inspect_optimizer_request(request))
        .map_err(|error| JsValue::from_str(&format!("Failed to serialize optimizer response: {error}")))
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
    fn validates_and_pays_resource_costs() {
        let result = validate_resource_cost(
            ResourcePool { ap: 12, mp: 6, wp: 6, bq: 500 },
            SpellCost { ap: 3, mp: 1, wp: 0, bq: 75 },
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
        assert_eq!(result.resources_after_cost, ResourcePool { ap: 9, mp: 5, wp: 6, bq: 425 });
        assert_eq!(result.context.position, AttackPosition::Rear);
        assert_eq!(result.context.range_mode, Some(RangeMode::Distance));
        assert!(result.context.is_critical);
        assert!(!result.context.is_berserk);
        assert!(!result.context.is_blocked);
    }

    #[test]
    fn rejects_insufficient_resource_without_paying_cost() {
        let result = validate_resource_cost(
            ResourcePool { ap: 2, mp: 6, wp: 6, bq: 500 },
            SpellCost { ap: 3, mp: 0, wp: 0, bq: 0 },
            "too-expensive",
            4,
            None,
        );

        assert!(!result.valid);
        assert_eq!(result.resources_after_cost, ResourcePool { ap: 2, mp: 6, wp: 6, bq: 500 });
        assert_eq!(result.context.position, AttackPosition::Face);
        assert_eq!(result.violation, Some(ResourceViolation {
            violation_type: "insufficientResource".to_string(),
            action_index: 4,
            spell_id: "too-expensive".to_string(),
            resource: "ap".to_string(),
            required: 3,
            available: 2,
        }));
    }

    #[test]
    fn computes_damage_with_contextual_masteries() {
        let formula = compute_raw_damage(
            &BaseStats {
                general_mastery: 100.0,
                elemental_mastery: ElementalMastery { fire: 200.0, ..Default::default() },
                distance_mastery: 50.0,
                rear_mastery: 25.0,
                critical_mastery: 75.0,
                damage_inflicted_percent: 10.0,
                ..Default::default()
            },
            &DamageEffect { element: Element::Fire, base: 20.0, times: Some(2.0) },
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

        assert_eq!(resolve_damage_element(&Element::Light, &stats), Element::Fire);
    }

    #[test]
    fn rounds_damage_to_two_decimals() {
        assert_eq!(round_damage(10.005), 10.01);
        assert_eq!(round_damage(10.004), 10.0);
    }
}
