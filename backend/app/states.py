"""Everything that differs between Punjab and UP lives here.

v1 had two ~665-line route files that were 95% identical; v2 serves both
states from one set of routes driven by this config. Adding a state means
adding a model and an entry below.
"""

from dataclasses import dataclass, field

from .models import PunjabSurvey, UPSurvey


@dataclass(frozen=True)
class Question:
    key: str  # column name on the model
    title: str
    question: str
    kind: str  # rating | choice | party | ranked | issue


@dataclass(frozen=True)
class Phase:
    name: str
    target: int  # cumulative complete surveys needed per AC


@dataclass(frozen=True)
class StateConfig:
    key: str
    name: str
    short: str
    model: type
    total_acs: int
    phases: tuple[Phase, ...]
    incumbent: str
    incumbent_rating: str  # column holding the government rating
    mla_rating: str
    mla_dissatisfied: tuple[str, ...]
    risk_threshold: float
    main_parties: tuple[str, ...]
    vote_columns: tuple[tuple[str, str], ...]  # (column, label)
    questions: dict[str, tuple[Question, ...]]
    csv_columns: dict[str, str]
    required_csv: tuple[str, ...]
    call_center_col: str | None = None
    extra_filters: tuple[str, ...] = field(default_factory=tuple)


DISSATISFIED_5PT = ("1. Very Dissatisfied", "2. Somewhat Dissatisfied")

# Answers that mean "no answer" and are folded together in charts.
NON_ANSWERS = {"", "Don't know/Can't Say", "Undecided", "Nota", "NOTA", "Did not vote"}
NO_ISSUE = ("No Issue", "No Issues", "None of the above", "None of the Above", "None", "")

FILTER_COLUMNS = ("gender", "age", "locality", "education", "occupation", "religion", "caste_category", "income")

_COMMON_CSV = {
    "AC Name": "ac_name",
    "Age": "age",
    "Gender": "gender",
    "Locality": "locality",
    "Awareness of Current MLA": "mla_awareness",
    "Frequency of MLA Visits": "mla_visit_frequency",
    "Preferred Candidate for Next MLA": "preferred_candidate",
    "Education": "education",
    "Occupation": "occupation",
    "Religion": "religion",
    "Caste": "caste",
    "Caste Category": "caste_category",
    "Income": "income",
    "Status": "status",
    "Date": "survey_date",
    "duplicacy_check": "duplicacy_check",
    "District": "district",
}

_DEMOGRAPHICS = (
    Question("gender", "Gender", "Respondent gender", "choice"),
    Question("age", "Age group", "Respondent age band", "ranked"),
    Question("locality", "Urban vs rural", "Where the respondent lives", "choice"),
    Question("education", "Education", "Highest education completed", "ranked"),
    Question("occupation", "Occupation", "Current occupation", "ranked"),
    Question("religion", "Religion", "Religious community", "choice"),
    Question("caste_category", "Caste category", "SC / OBC / General / etc.", "ranked"),
    Question("caste", "Top castes / communities", "Self-identified caste", "ranked"),
    Question("income", "Monthly household income", "Income bracket", "ranked"),
)

PUNJAB = StateConfig(
    key="punjab",
    name="Punjab",
    short="PB",
    model=PunjabSurvey,
    total_acs=117,
    phases=(Phase("Phase 1", 75), Phase("Phase 2", 150)),
    incumbent="AAP",
    incumbent_rating="aap_govt_rating",
    mla_rating="mla_satisfaction",
    mla_dissatisfied=("Dissatisfied",),
    risk_threshold=0.40,
    main_parties=("AAP", "INC", "SAD", "BJP", "Waris Punjab De", "SAD-A", "Independent", "BSP"),
    vote_columns=(("vote_2022", "2022 Assembly vote"), ("vote_intention", "Vote if election held tomorrow")),
    call_center_col="call_center_location",
    questions={
        "leadership": (
            Question("aap_govt_rating", "AAP government rating", "How satisfied are you with the overall performance of the AAP government?", "rating"),
            Question("bhagwant_mann_rating", "Bhagwant Mann rating", "How satisfied are you with Bhagwant Mann as Chief Minister?", "rating"),
            Question("preferred_cm", "Preferred next Chief Minister", "Who is your preferred choice for the next Chief Minister of Punjab?", "ranked"),
        ),
        "mla": (
            Question("mla_awareness", "Knows current MLA", "Do you know who your current Assembly MLA is?", "choice"),
            Question("mla_visit_frequency", "MLA visit frequency", "How frequently does your current MLA visit your area?", "choice"),
            Question("mla_satisfaction", "Satisfaction with MLA", "How satisfied are you with the performance of your MLA?", "choice"),
            Question("preferred_candidate", "Preferred next MLA", "Who would you prefer as your next MLA candidate?", "ranked"),
        ),
        "voting": (
            Question("vote_2022", "2022 Assembly vote", "Whom did you vote for in the 2022 Punjab Assembly elections?", "party"),
            Question("vote_intention", "Vote if election held tomorrow", "If Punjab Assembly elections were held tomorrow, which party would you vote for?", "party"),
        ),
        "issues": (
            Question("failure", "Top failures of the AAP government", "Top 1 and Top 2 failures combined", "issue"),
            Question("success", "Top successes of the AAP government", "Top 1 and Top 2 successes combined", "issue"),
        ),
        "demographics": _DEMOGRAPHICS,
    },
    csv_columns={
        **_COMMON_CSV,
        "Ward Number": "ward_number",
        "Village Name": "village_name",
        "Performance Rating of AAP Government": "aap_govt_rating",
        "Performance Rating of Bhagwant Mann": "bhagwant_mann_rating",
        "Satisfaction with MLA Performance": "mla_satisfaction",
        "Preferred Next Chief Minister of Punjab": "preferred_cm",
        "Whom did you vote for in the 2022 assembly elections?": "vote_2022",
        "If the Punjab Assembly elections were held tomorrow which party would you vote for?": "vote_intention",
        "Call center location": "call_center_location",
        "Top 1 Failures of AAP Government": "failure_1",
        "Top 2 Failures of AAP Government": "failure_2",
        "Top 1 Successes of AAP Government": "success_1",
        "Top 2 Successes of AAP Government": "success_2",
    },
    # The rating column doubles as a signature, so a UP file can't be loaded as Punjab.
    required_csv=("AC Name", "Status", "Date", "District", "Performance Rating of AAP Government"),
)

UP = StateConfig(
    key="up",
    name="Uttar Pradesh",
    short="UP",
    model=UPSurvey,
    total_acs=403,
    phases=(Phase("Phase 1", 50),),
    incumbent="BJP",
    incumbent_rating="yogi_rating",
    mla_rating="mla_rating",
    mla_dissatisfied=DISSATISFIED_5PT,
    risk_threshold=0.35,
    main_parties=("BJP", "SP", "BSP", "INC", "RLD", "ASP", "AIMIM", "AAP"),
    vote_columns=(
        ("vote_2022", "2022 Assembly vote"),
        ("vote_2024_ls", "2024 Lok Sabha vote"),
        ("vote_intention", "Current voting intention"),
    ),
    questions={
        "leadership": (
            Question("yogi_rating", "Yogi Adityanath rating", "How satisfied are you with Yogi Adityanath as Chief Minister?", "rating"),
            Question("akhilesh_rating", "Akhilesh Yadav rating", "How do you rate Akhilesh Yadav as the opposition leader?", "rating"),
            Question("preferred_cm", "Preferred next Chief Minister", "Who is your preferred choice for the next Chief Minister of UP?", "ranked"),
        ),
        "mla": (
            Question("mla_awareness", "Knows current MLA", "Do you know who your current Assembly MLA is?", "choice"),
            Question("mla_visit_frequency", "MLA visit frequency", "How frequently does your current MLA visit your area?", "choice"),
            Question("mla_rating", "Current MLA rating", "How do you rate the overall performance of your MLA?", "rating"),
            Question("preferred_candidate", "Preferred next MLA", "Who would you prefer as your next MLA candidate?", "ranked"),
        ),
        "voting": (
            Question("vote_2022", "2022 Assembly vote", "Whom did you vote for in the 2022 UP Assembly elections?", "party"),
            Question("vote_2024_ls", "2024 Lok Sabha vote", "Whom did you vote for in the 2024 Lok Sabha elections?", "party"),
            Question("vote_intention", "Current voting intention", "If UP Assembly elections were held today, which party would you vote for?", "party"),
        ),
        "issues": (
            Question("failure", "Top failures of the BJP government", "Top 1 and Top 2 failures combined", "issue"),
            Question("success", "Top successes of the BJP government", "Top 1 and Top 2 successes combined", "issue"),
        ),
        "demographics": _DEMOGRAPHICS,
    },
    csv_columns={
        **_COMMON_CSV,
        "Ward/Village Name": "ward_village_name",
        "Performance Rating of Yogi Adityanath": "yogi_rating",
        "Performance Rating of Akhilesh Yadav": "akhilesh_rating",
        "Performance Rating of Current MLA": "mla_rating",
        "Preferred Next Chief Minister of Uttar Pradesh": "preferred_cm",
        "2022 Uttar Pradesh Assembly Election Vote": "vote_2022",
        "2024 Lok Sabha Election Vote": "vote_2024_ls",
        "Current Voting Intention – Uttar Pradesh Assembly Election": "vote_intention",
        "Top 1 Failures of BJP Government": "failure_1",
        "Top 2 Failures of BJP Government": "failure_2",
        "Top 1 Successes of BJP Government": "success_1",
        "Top 2 Successes of BJP Government": "success_2",
    },
    required_csv=("AC Name", "Status", "Date", "District", "Performance Rating of Yogi Adityanath"),
)

STATES: dict[str, StateConfig] = {"punjab": PUNJAB, "up": UP}

# Which roles may see / upload which state.
ROLE_STATES: dict[str, set[str]] = {
    "admin": {"punjab", "up"},
    "viewer": {"punjab", "up"},
    "punjab": {"punjab"},
    "up": {"up"},
}
UPLOAD_ROLES: dict[str, set[str]] = {
    "admin": {"punjab", "up"},
    "punjab": {"punjab"},
    "up": {"up"},
    "viewer": set(),
}
