"""Seed curriculum. Sources are English + Hindi (authored by the team).
Tribal-language entries are DRAFTS: they must be verified by a native-speaker teacher
in the Content Review screen before being trusted in class."""

def S(i, en, hi):
    return {"id": i, "en": en, "hi": hi}


def Q(i, qen, qhi, options, answer):
    return {"id": i, "q": {"en": qen, "hi": qhi}, "options": [{"en": a, "hi": b} for a, b in options], "answer": answer}


LESSONS = [
    {
        "slug": "plants-around-us", "title_en": "Plants Around Us", "title_hi": "हमारे आस-पास के पौधे",
        "subject": "EVS", "grade": 3, "emoji": "🌳", "minutes": 6,
        "sections": [
            S(1, "Plants are living things. They grow, and they need water and sunlight.", "पौधे जीवित चीज़ें हैं। वे बढ़ते हैं और उन्हें पानी और धूप चाहिए।"),
            S(2, "Roots hold the plant in the soil and drink water.", "जड़ें पौधे को मिट्टी में थामे रखती हैं और पानी पीती हैं।"),
            S(3, "Leaves make food for the plant using sunlight.", "पत्तियाँ धूप की मदद से पौधे के लिए भोजन बनाती हैं।"),
            S(4, "Trees give us fruits, shade and fresh air.", "पेड़ हमें फल, छाया और ताज़ी हवा देते हैं।"),
            S(5, "Sal and mahua trees are very important in our forests.", "हमारे जंगलों में साल और महुआ के पेड़ बहुत महत्वपूर्ण हैं।"),
        ],
        "vocab": [
            {"en": "root", "hi": "जड़", "emoji": "🌱"}, {"en": "leaf", "hi": "पत्ती", "emoji": "🍃"},
            {"en": "tree", "hi": "पेड़", "emoji": "🌳"}, {"en": "water", "hi": "पानी", "emoji": "💧"},
            {"en": "sun", "hi": "सूरज", "emoji": "☀️"}, {"en": "fruit", "hi": "फल", "emoji": "🍎"},
        ],
        "quiz": [
            Q(1, "What do roots do?", "जड़ें क्या करती हैं?", [("Drink water from the soil", "मिट्टी से पानी पीती हैं"), ("Make sounds", "आवाज़ करती हैं"), ("Catch fish", "मछली पकड़ती हैं")], 0),
            Q(2, "Which part makes food for the plant?", "पौधे के लिए भोजन कौन-सा भाग बनाता है?", [("Stone", "पत्थर"), ("Leaves", "पत्तियाँ"), ("Roots", "जड़ें")], 1),
            Q(3, "Trees give us...", "पेड़ हमें देते हैं...", [("Fresh air", "ताज़ी हवा"), ("Smoke", "धुआँ"), ("Plastic", "प्लास्टिक")], 0),
        ],
    },
    {
        "slug": "numbers-1-to-10", "title_en": "Numbers 1 to 10", "title_hi": "एक से दस तक गिनती",
        "subject": "Maths", "grade": 1, "emoji": "🔢", "minutes": 4,
        "sections": [
            S(1, "Let us count from one to ten.", "आओ एक से दस तक गिनें।"),
            S(2, "One, two, three, four, five.", "एक, दो, तीन, चार, पाँच।"),
            S(3, "Six, seven, eight, nine, ten.", "छह, सात, आठ, नौ, दस।"),
            S(4, "I have two hands and ten fingers.", "मेरे दो हाथ और दस उँगलियाँ हैं।"),
        ],
        "vocab": [
            {"en": "one", "hi": "एक", "emoji": "1️⃣"}, {"en": "two", "hi": "दो", "emoji": "2️⃣"},
            {"en": "three", "hi": "तीन", "emoji": "3️⃣"}, {"en": "four", "hi": "चार", "emoji": "4️⃣"},
            {"en": "five", "hi": "पाँच", "emoji": "5️⃣"}, {"en": "six", "hi": "छह", "emoji": "6️⃣"},
            {"en": "seven", "hi": "सात", "emoji": "7️⃣"}, {"en": "eight", "hi": "आठ", "emoji": "8️⃣"},
            {"en": "nine", "hi": "नौ", "emoji": "9️⃣"}, {"en": "ten", "hi": "दस", "emoji": "🔟"},
        ],
        "quiz": [
            Q(1, "How many fingers are on two hands?", "दो हाथों में कितनी उँगलियाँ होती हैं?", [("Five", "पाँच"), ("Ten", "दस"), ("Two", "दो")], 1),
            Q(2, "What comes after seven?", "सात के बाद क्या आता है?", [("Six", "छह"), ("Nine", "नौ"), ("Eight", "आठ")], 2),
            Q(3, "Which number is the biggest?", "सबसे बड़ी संख्या कौन-सी है?", [("Four", "चार"), ("Nine", "नौ"), ("Two", "दो")], 1),
        ],
    },
    {
        "slug": "my-family", "title_en": "My Family", "title_hi": "मेरा परिवार",
        "subject": "Language", "grade": 2, "emoji": "👨‍👩‍👧", "minutes": 4,
        "sections": [
            S(1, "I live with my family.", "मैं अपने परिवार के साथ रहता हूँ।"),
            S(2, "My mother cooks food for us.", "मेरी माँ हमारे लिए खाना बनाती हैं।"),
            S(3, "My father works in the field.", "मेरे पिता खेत में काम करते हैं।"),
            S(4, "My grandmother tells us stories.", "मेरी दादी हमें कहानियाँ सुनाती हैं।"),
            S(5, "We love each other.", "हम एक-दूसरे से प्यार करते हैं।"),
        ],
        "vocab": [
            {"en": "mother", "hi": "माँ", "emoji": "👩"}, {"en": "father", "hi": "पिता", "emoji": "👨"},
            {"en": "brother", "hi": "भाई", "emoji": "👦"}, {"en": "sister", "hi": "बहन", "emoji": "👧"},
            {"en": "house", "hi": "घर", "emoji": "🏠"}, {"en": "village", "hi": "गाँव", "emoji": "🏘️"},
        ],
        "quiz": [
            Q(1, "Who cooks food for us?", "हमारे लिए खाना कौन बनाता है?", [("My mother", "मेरी माँ"), ("The moon", "चाँद"), ("A tree", "एक पेड़")], 0),
            Q(2, "Where does the father work?", "पिता कहाँ काम करते हैं?", [("In the river", "नदी में"), ("In the field", "खेत में"), ("In the sky", "आसमान में")], 1),
        ],
    },
    {
        "slug": "water-is-life", "title_en": "Water Is Life", "title_hi": "जल ही जीवन है",
        "subject": "EVS", "grade": 3, "emoji": "💧", "minutes": 5,
        "sections": [
            S(1, "We drink water every day.", "हम रोज़ पानी पीते हैं।"),
            S(2, "Water comes from rain, rivers, wells and ponds.", "पानी बारिश, नदियों, कुओं और तालाबों से मिलता है।"),
            S(3, "Dirty water can make us sick.", "गंदा पानी हमें बीमार कर सकता है।"),
            S(4, "Boil or filter water before drinking.", "पीने से पहले पानी को उबालें या छानें।"),
            S(5, "Do not waste water.", "पानी बर्बाद मत करो।"),
        ],
        "vocab": [
            {"en": "water", "hi": "पानी", "emoji": "💧"}, {"en": "rain", "hi": "बारिश", "emoji": "🌧️"},
            {"en": "river", "hi": "नदी", "emoji": "🏞️"}, {"en": "well", "hi": "कुआँ", "emoji": "🪣"},
            {"en": "fish", "hi": "मछली", "emoji": "🐟"},
        ],
        "quiz": [
            Q(1, "What should we do before drinking water?", "पीने से पहले हमें क्या करना चाहिए?", [("Boil or filter it", "उबालें या छानें"), ("Throw it", "फेंक दें"), ("Freeze a stone", "पत्थर जमाएँ")], 0),
            Q(2, "Dirty water can make us...", "गंदा पानी हमें ... कर सकता है", [("Strong", "मज़बूत"), ("Sick", "बीमार"), ("Taller", "लंबा")], 1),
            Q(3, "Water comes from...", "पानी कहाँ से मिलता है...", [("Rain and rivers", "बारिश और नदियों से"), ("Books", "किताबों से"), ("Shoes", "जूतों से")], 0),
        ],
    },
    {
        "slug": "birds-and-animals", "title_en": "Birds and Animals", "title_hi": "पक्षी और जानवर",
        "subject": "EVS", "grade": 2, "emoji": "🐦", "minutes": 5,
        "sections": [
            S(1, "Birds have wings and feathers.", "पक्षियों के पंख होते हैं।"),
            S(2, "Most birds can fly.", "ज़्यादातर पक्षी उड़ सकते हैं।"),
            S(3, "Cows give us milk.", "गायें हमें दूध देती हैं।"),
            S(4, "Dogs guard our homes.", "कुत्ते हमारे घरों की रखवाली करते हैं।"),
            S(5, "We must be kind to animals.", "हमें जानवरों के प्रति दयालु होना चाहिए।"),
        ],
        "vocab": [
            {"en": "bird", "hi": "चिड़िया", "emoji": "🐦"}, {"en": "dog", "hi": "कुत्ता", "emoji": "🐕"},
            {"en": "cow", "hi": "गाय", "emoji": "🐄"}, {"en": "fish", "hi": "मछली", "emoji": "🐟"},
        ],
        "quiz": [
            Q(1, "What do birds have?", "पक्षियों के पास क्या होता है?", [("Wings", "पंख"), ("Wheels", "पहिए"), ("Fins only", "सिर्फ़ पंख (मछली वाले)")], 0),
            Q(2, "Who gives us milk?", "हमें दूध कौन देता है?", [("Dogs", "कुत्ते"), ("Cows", "गायें"), ("Birds", "पक्षी")], 1),
        ],
    },
    {
        "slug": "thirsty-crow", "title_en": "Story: The Thirsty Crow", "title_hi": "कहानी: प्यासा कौआ",
        "subject": "Language", "grade": 3, "emoji": "🐦‍⬛", "minutes": 6,
        "sections": [
            S(1, "A crow was very thirsty.", "एक कौआ बहुत प्यासा था।"),
            S(2, "He found a pot with a little water at the bottom.", "उसे एक घड़ा मिला जिसके तल में थोड़ा पानी था।"),
            S(3, "His beak could not reach the water.", "उसकी चोंच पानी तक नहीं पहुँच सकी।"),
            S(4, "He dropped small stones into the pot.", "उसने घड़े में छोटे-छोटे कंकड़ डाले।"),
            S(5, "The water rose, and the crow drank happily.", "पानी ऊपर आ गया और कौए ने खुशी से पानी पिया।"),
            S(6, "Where there is a will, there is a way.", "जहाँ चाह, वहाँ राह।"),
        ],
        "vocab": [
            {"en": "crow", "hi": "कौआ", "emoji": "🐦‍⬛"}, {"en": "stone", "hi": "कंकड़", "emoji": "🪨"},
            {"en": "thirsty", "hi": "प्यासा", "emoji": "🥵"}, {"en": "pot", "hi": "घड़ा", "emoji": "🏺"},
        ],
        "quiz": [
            Q(1, "Why did the crow drop stones in the pot?", "कौए ने घड़े में कंकड़ क्यों डाले?", [("To raise the water", "पानी ऊपर लाने के लिए"), ("To break the pot", "घड़ा तोड़ने के लिए"), ("To play a game", "खेल खेलने के लिए")], 0),
            Q(2, "How did the crow feel at the end?", "अंत में कौआ कैसा महसूस कर रहा था?", [("Sad", "उदास"), ("Happy", "खुश"), ("Angry", "गुस्से में")], 1),
            Q(3, "What is the lesson of the story?", "कहानी की सीख क्या है?", [("Where there is a will, there is a way", "जहाँ चाह, वहाँ राह"), ("Never drink water", "कभी पानी मत पियो"), ("Crows are slow", "कौए धीमे होते हैं")], 0),
        ],
    },
]

# Classroom phrasebook (en <-> hi), used for live-class translation memory. Authored by the team.
PHRASES = [
    ("Good morning, children.", "सुप्रभात बच्चों।"),
    ("Please sit down.", "कृपया बैठ जाइए।"),
    ("Open your books.", "अपनी किताबें खोलो।"),
    ("Listen carefully.", "ध्यान से सुनो।"),
    ("Repeat after me.", "मेरे बाद दोहराओ।"),
    ("Do you understand?", "क्या आप समझ गए?"),
    ("Any questions?", "कोई प्रश्न?"),
    ("Well done!", "शाबाश!"),
    ("Try again.", "फिर से कोशिश करो।"),
    ("Today we will learn about plants.", "आज हम पौधों के बारे में सीखेंगे।"),
    ("Today we will learn about water.", "आज हम पानी के बारे में सीखेंगे।"),
    ("Look at the picture.", "तस्वीर को देखो।"),
    ("Write the answer in your notebook.", "अपनी कॉपी में उत्तर लिखो।"),
    ("Raise your hand if you know the answer.", "उत्तर पता हो तो हाथ उठाओ।"),
    ("Work with your partner.", "अपने साथी के साथ काम करो।"),
    ("Tomorrow we will have a small quiz.", "कल हम एक छोटी प्रश्नोत्तरी करेंगे।"),
    ("Please be quiet.", "कृपया शांत रहो।"),
    ("Let us read together.", "आओ साथ मिलकर पढ़ें।"),
    ("Everyone stand up.", "सब खड़े हो जाओ।"),
    ("The class is over. Thank you.", "कक्षा समाप्त। धन्यवाद।"),
]

# ---------------------------------------------------------------------------
# Tribal-language glossary (Roman transliteration). ALL DRAFT - needs native-speaker review.
# Missing cells are intentional: they show up as "add this word" in Bhasha Kosh.
# ---------------------------------------------------------------------------
GLOSSARY = {
    # english: (hindi, {lang: term})
    "hello": ("नमस्ते", {"sat": "Johar", "unr": "Johar", "hoc": "Juar", "kru": "Johar"}),
    "one": ("एक", {"sat": "mit'", "unr": "mi", "hoc": "mia", "kru": "ort"}),
    "two": ("दो", {"sat": "bar", "unr": "bar", "hoc": "bar", "kru": "end"}),
    "three": ("तीन", {"sat": "pe", "unr": "api", "hoc": "api", "kru": "mund"}),
    "four": ("चार", {"sat": "pon", "unr": "upun", "hoc": "upun", "kru": "nakh"}),
    "five": ("पाँच", {"sat": "mo\u1e5be", "unr": "mone", "hoc": "moe", "kru": "pancho"}),
    "six": ("छह", {"sat": "turui", "unr": "turui", "hoc": "turui", "kru": "sox"}),
    "seven": ("सात", {"sat": "eae", "unr": "eae", "hoc": "ea", "kru": "sat"}),
    "eight": ("आठ", {"sat": "irel", "unr": "irel", "hoc": "irel", "kru": "ath"}),
    "nine": ("नौ", {"sat": "arae", "unr": "are", "hoc": "are", "kru": "naw"}),
    "ten": ("दस", {"sat": "gel", "unr": "gel", "hoc": "gel", "kru": "das"}),
    "tree": ("पेड़", {"sat": "daru", "unr": "daru", "hoc": "daru"}),
    "water": ("पानी", {"sat": "dak'", "unr": "da", "hoc": "da"}),
    "sun": ("सूरज", {"sat": "sin", "unr": "sing", "hoc": "sing"}),
    "moon": ("चाँद", {"sat": "chando", "unr": "chando", "hoc": "chando"}),
    "mother": ("माँ", {"sat": "ayo", "unr": "ayo", "hoc": "ayo"}),
    "father": ("पिता", {"sat": "baba", "unr": "aba", "hoc": "aba"}),
    "dog": ("कुत्ता", {"sat": "seta", "unr": "seta", "hoc": "seta"}),
    "bird": ("चिड़िया", {"sat": "chere", "unr": "chere", "hoc": "chere"}),
    "fish": ("मछली", {"sat": "hako", "unr": "hako", "hoc": "hako"}),
    "house": ("घर", {"sat": "ora", "unr": "ora", "hoc": "ora"}),
    "village": ("गाँव", {"sat": "ato", "unr": "ato", "hoc": "ato"}),
    "rice": ("चावल", {"sat": "daka", "unr": "daka", "hoc": "daka"}),
}
