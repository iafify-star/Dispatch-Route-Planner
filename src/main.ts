    (() => {
      "use strict";
  type ProductType = "frozen" | "chilled" | "ambient";
  type TabName = "today" | "routes" | "drivers" | "stores" | "fleet" | "settings" | "guide";
  type TruckType = "reefer" | "dry";
  type PalletCounts = Record<ProductType, number>;

  interface Coordinates {
    lat: number;
    lng: number;
  }
  function slotStart(store: Store, slot: number): string {
    return slot === 1 ? store.slot1From : store.slot2From;
  }
  function slotEnd(store: Store, slot: number): string {
    return slot === 1 ? store.slot1To : store.slot2To;
  }

  interface Store {
    id: string;
    code: string;
    name: string;
    location: string;
    coords: Coordinates | null;
    slot1From: string;
    slot1To: string;
    slot2From: string;
    slot2To: string;
    active: boolean;
  }

  interface Truck {
    id: string;
    plate: string;
    type: TruckType;
    capacity: number;
    driver: string;
    phone: string;
  }

  interface SpeedBand {
    until: string;
    speed: number;
  }

  interface PlannerSettings {
    warehouseName: string;
    warehouseLocation: string;
    shiftStart: string;
    shiftEnd: string;
    loadMinutes: number;
    stopMinutes: number;
    palletMinutes: number;
    maxTrips: number;
    roadFactor: number;
    planningEffort: number;
    speeds: SpeedBand[];
    logo: string;
  }

  interface Order {
    frozen: number;
    chilled: number;
    ambient: number;
  }

  interface Demand {
    store: Store;
    slot: number;
    type: ProductType;
    quantity: number;
  }

  interface AssignedDemand {
    store: Store;
    slot: number;
    type: ProductType;
    count: number;
  }

  interface StopDraft {
    store: Store;
    slot: number;
    items: TripItem[];
    load: number;
  }

  interface TripItem {
    type: ProductType;
    count: number;
  }

  interface PlannedStop {
    store: string;
    coords: Coordinates | null;
    arrive: string;
    slot: number;
    items: TripItem[];
    load: number;
  }

  interface TripPart {
    percent: number;
    color: string;
  }

  interface PlannedTrip {
    truck: string;
    truckId: string;
    number: number;
    mode: string;
    depart: string;
    returnAt: string;
    km: number;
    load: number;
    fill: number;
    capacity: number;
    stops: PlannedStop[];
    items: TripItem[];
    color: string;
    parts: TripPart[];
    mapUrl: string;
  }

  interface UnplannedOrder {
    store: string;
    quantity: number;
    type: ProductType;
    reason: string;
  }

  interface Plan {
    date: string;
    trips: PlannedTrip[];
    unplanned: UnplannedOrder[];
    available: number;
    totals: PalletCounts;
    outdated?: boolean;
  }

  interface PlannerState {
    stores: Store[];
    trucks: Truck[];
    date: string;
    pallets: PalletCounts;
    orders: Record<string, Order>;
    ordersByDate: Record<string, Record<string, Order>>;
    settings: PlannerSettings;
    availability: Record<string, boolean>;
    plan: Plan | null;
  }

  const KEY = "dispatch-route-planner-v1";
      const localDateString = (date: Date): string => {
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
      };
      function isTabName(value: string | undefined): value is TabName {
        return value === "today" || value === "routes" || value === "drivers" ||
          value === "stores" || value === "fleet" || value === "settings" || value === "guide";
      }
      function isProductType(value: string | undefined): value is ProductType {
        return value === "frozen" || value === "chilled" || value === "ambient";
      }
      function isSettingKey(value: string | undefined): value is keyof PlannerSettings {
        return value === "warehouseName" || value === "warehouseLocation" ||
          value === "shiftStart" || value === "shiftEnd" || value === "loadMinutes" ||
          value === "stopMinutes" || value === "palletMinutes" || value === "maxTrips" ||
          value === "roadFactor" || value === "planningEffort";
      }
      const defaultState = (): PlannerState => ({
        stores: [], trucks: [], date: localDateString(new Date()),
        pallets: { frozen: 0, chilled: 0, ambient: 0 }, orders: {}, ordersByDate: {},
        settings: {
          warehouseName: "Industrial Zone, 6th of October City (2)", warehouseLocation: "",
          shiftStart: "19:00", shiftEnd: "07:00", loadMinutes: 30, stopMinutes: 20,
          palletMinutes: 5, maxTrips: 2, roadFactor: 1.3, planningEffort: 60,
          speeds: [{ until: "22:00", speed: 35 }, { until: "01:00", speed: 45 }, { until: "07:00", speed: 60 }],
          logo: ""
        },
        availability: {}, plan: null
      });
      const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
      let state: PlannerState = defaultState();
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) state = { ...defaultState(), ...JSON.parse(stored) };
      } catch (error) {
        console.error("Could not load saved planner data.", error);
      }
      type Language = "en" | "ar";
      const LANGUAGE_KEY = "dispatch-route-planner-language";
      let language: Language = "en";
      try {
        language = localStorage.getItem(LANGUAGE_KEY) === "ar" ? "ar" : "en";
      } catch (error) {
        console.error("Could not load the saved language preference.", error);
      }
      let currentTab: TabName = "today";
      let message = "";
      let messageIsError = false;
      const main = document.getElementById("main")!;
      const arabic: Record<string, string> = {
        "Dispatch Route Planner": "مخطط مسارات التوصيل",
        "Saved on this device": "تم الحفظ على هذا الجهاز",
        "Could not save": "تعذّر الحفظ",
        "Switch language": "تغيير اللغة",
        "Today’s plan": "خطة اليوم",
        "Routes & map": "المسارات والخريطة",
        "Driver run sheets": "جداول السائقين",
        "Stores": "المتاجر",
        "Fleet": "الأسطول",
        "Settings": "الإعدادات",
        "Guide": "دليل الاستخدام",
        "Planner sections": "أقسام المخطط",
        "Ambient + Frozen/Chilled": "جاف + مجمد/مبرد",
        "Tonight’s dispatch": "توصيلات الليلة",
        "Shift date": "تاريخ الوردية",
        "Before you plan": "قبل التخطيط",
        "Set the warehouse map location in": "حدّد موقع المستودع على الخريطة في",
        "Add your trucks in": "أضف شاحناتك في",
        "Until then you can": "وإلى ذلك الحين يمكنك",
        "try a sample plan": "تجربة خطة نموذجية",
        "using your stores and made-up trucks and orders.": "باستخدام متاجرك وشاحنات وطلبات افتراضية.",
        " and ": " و ",
        " stores. Paste a Google Maps link, “lat, lng”, or the degrees format from your sheet into Location. Times save as you type.": " متاجر. ألصق رابط خرائط Google أو الإحداثيات أو صيغة الدرجات من جدولك في الموقع. تُحفظ الأوقات أثناء الكتابة.",
        "1 · Trucks available tonight": "١ · الشاحنات المتاحة الليلة",
        "Tap a truck to take it out of tonight’s plan. Each truck can run up to": "اضغط على الشاحنة لاستبعادها من خطة الليلة. يمكن لكل شاحنة تنفيذ",
        "trips between": "رحلات كحد أقصى بين",
        "2 · Pallets ready to dispatch": "٢ · منصات البضائع الجاهزة للتوصيل",
        "What the warehouse has picked and staged. The planner checks it against the store orders below.": "البضائع التي جهزها المستودع. يقارنها المخطط بطلبات المتاجر أدناه.",
        "Frozen / Chilled": "مجمد / مبرد",
        "Frozen pallets": "منصات مجمدة",
        "Chilled pallets": "منصات مبردة",
        "Ambient pallets": "منصات جافة",
        "Frozen": "مجمد",
        "Chilled": "مبرد",
        "Ambient": "جاف",
        "ordered": "مطلوب",
        "3 · Store orders by delivery slot": "٣ · طلبات المتاجر حسب فترة التوصيل",
        "Copy last saved day": "نسخ طلبات اليوم السابق",
        "Excel template": "نموذج Excel",
        "Import orders": "استيراد الطلبات",
        "Clear": "مسح",
        "Enter pallets per store for each slot. A store gets a second delivery only if you put pallets in slot 2. Frozen and chilled must go on frozen/chilled trucks; ambient can ride on any truck.": "أدخل عدد المنصات لكل متجر ولكل فترة. تتم إضافة توصيل ثانٍ عند إدخال منصات في الفترة الثانية. يجب نقل المجمد والمبرد بشاحنات التبريد، ويمكن نقل البضائع الجافة بأي شاحنة.",
        "Review the orders, then build the night’s routes.": "راجع الطلبات ثم أنشئ مسارات الليلة.",
        "Enter store orders to plan.": "أدخل طلبات المتاجر لبدء التخطيط.",
        "Plan routes →": "خطط المسارات ←",
        "Not connected to shared storage.": "غير متصل بمخزن بيانات مشترك.",
        "Changes are saved in this browser only, so your team won’t see them. Open the planner from its claude.ai link while signed in to share data.": "تُحفظ التغييرات في هذا المتصفح فقط ولن يراها فريقك. افتح المخطط من رابط claude.ai أثناء تسجيل الدخول لمشاركة البيانات.",
        "No trucks yet.": "لا توجد شاحنات بعد.",
        "Add trucks": "أضف شاحنات",
        "Dry": "جاف",
        "pallets": "منصات",
        "Store": "المتجر",
        "Slot 1 · Frozen": "الفترة ١ · مجمد",
        "Slot 2 · Frozen": "الفترة ٢ · مجمد",
        "No slot": "لا توجد فترة",
        "No stores yet": "لا توجد متاجر بعد",
        "Add stores or import them from Excel.": "أضف متاجر أو استوردها من Excel.",
        "Go to Stores": "انتقل إلى المتاجر",
        "Add a store": "إضافة متجر",
        "Store code": "رمز المتجر",
        "Store name": "اسم المتجر",
        "Location (Google Maps link or lat, lng)": "الموقع (رابط خرائط Google أو خط العرض والطول)",
        "Slot 1 from": "الفترة ١ من",
        "Slot 1 to": "الفترة ١ إلى",
        "Slot 2 from": "الفترة ٢ من",
        "Slot 2 to": "الفترة ٢ إلى",
        "Add store": "إضافة المتجر",
        "Store list": "قائمة المتاجر",
        "Location": "الموقع",
        "Slot 1": "الفترة ١",
        "Slot 2": "الفترة ٢",
        "Status": "الحالة",
        "Missing": "غير محدد",
        "Active": "نشط",
        "Delete": "حذف",
        "Nothing to show on the map yet.": "لا توجد بيانات لعرضها على الخريطة بعد.",
        "Import from Excel": "استيراد من Excel",
        "Add a truck": "إضافة شاحنة",
        "trucks:": "شاحنات:",
        "frozen/chilled,": "مجمد/مبرد،",
        "dry. Capacity is in pallets. Frozen/chilled trucks have a movable separator: one cold temperature (frozen or chilled) plus ambient on each trip, or ambient only with the unit off.": "جاف. السعة محسوبة بالمنصات. يمكن لشاحنات التبريد نقل نوع واحد من البضائع الباردة (مجمدة أو مبردة) مع بضائع جافة، أو بضائع جافة فقط عند إيقاف التبريد.",
        "Truck number / plate": "رقم الشاحنة / اللوحة",
        "Type": "النوع",
        "Capacity (pallets)": "السعة (منصات)",
        "Driver": "السائق",
        "Driver phone": "هاتف السائق",
        "Optional": "اختياري",
        "Add truck": "إضافة الشاحنة",
        "Truck": "الشاحنة",
        "Capacity": "السعة",
        "Phone": "الهاتف",
        "No trucks yet": "لا توجد شاحنات بعد",
        "Add your trucks above. You choose which ones are available each night on Today’s plan.": "أضف شاحناتك أعلاه، ثم اختر المتاح منها كل ليلة في خطة اليوم.",
        "These rules apply to every plan. Changes save automatically.": "تُطبق هذه الإعدادات على كل الخطط، وتُحفظ التغييرات تلقائيًا.",
        "Warehouse": "المستودع",
        "Both the ambient and the frozen/chilled warehouse are on this site, so every trip starts and ends here.": "يوجد مستودع البضائع الجافة ومستودع المجمدات والمبردات في هذا الموقع، لذلك تبدأ كل رحلة وتنتهي هنا.",
        "Name": "الاسم",
        "Map location (Google Maps link or lat, lng)": "الموقع على الخريطة (رابط خرائط Google أو خط العرض والطول)",
        "Paste the warehouse pin": "الصق رابط موقع المستودع",
        "Location set": "تم تحديد الموقع",
        "Location missing": "الموقع غير محدد",
        "Shift & handling times": "الوردية وأوقات المناولة",
        "Trucks available from": "بدء توفر الشاحنات",
        "Trucks back by": "موعد عودة الشاحنات",
        "Loading per trip (min)": "التحميل لكل رحلة (دقيقة)",
        "Unloading per stop (min)": "التفريغ لكل محطة (دقيقة)",
        "Unloading per pallet (min)": "التفريغ لكل منصة (دقيقة)",
        "Max trips per truck": "الحد الأقصى للرحلات لكل شاحنة",
        "Travel time estimate": "تقدير وقت الرحلة",
        "Road distance = straight-line distance × road factor. Driving time uses the speed for the time a truck leaves each stop, to reflect Cairo traffic.": "مسافة الطريق = المسافة المباشرة × معامل الطريق. يُقدّر وقت القيادة باستخدام السرعة المحددة لوقت مغادرة الشاحنة لكل محطة لمراعاة حركة المرور في القاهرة.",
        "Road factor": "معامل الطريق",
        "Planning effort (tries)": "جهد التخطيط (عدد المحاولات)",
        "Until": "حتى",
        "Average speed (km/h)": "متوسط السرعة (كم/ساعة)",
        "Brand logo": "شعار العلامة التجارية",
        "Upload your logo (PNG, JPG, SVG or WebP). It replaces the placeholder in the top bar on this device.": "ارفع شعارك (PNG أو JPG أو SVG أو WebP) ليحل محل الشعار الافتراضي في الشريط العلوي على هذا الجهاز.",
        "Upload logo": "رفع الشعار",
        "Pick tonight’s trucks and enter store orders on Today’s plan, then press Plan routes.": "اختر شاحنات الليلة وأدخل طلبات المتاجر في خطة اليوم، ثم اضغط «خطط المسارات».",
        "Enter orders": "أدخل الطلبات",
        "Try a sample plan": "جرّب خطة نموذجية",
        "Plan out of date.": "الخطة قديمة.",
        "Your orders or fleet changed. Re-plan to refresh these routes.": "تغيرت الطلبات أو الأسطول. أعد التخطيط لتحديث المسارات.",
        "Planned trips": "الرحلات المخططة",
        "Not planned": "طلبات غير مخططة",
        "Export to Excel": "تصدير إلى Excel",
        "Re-plan": "أعد التخطيط",
        "Trucks used": "الشاحنات المستخدمة",
        "Trips": "الرحلات",
        "Average fill": "متوسط الامتلاء",
        "Pallets planned": "المنصات المخططة",
        "Estimated km": "المسافة المقدرة (كم)",
        "No trips could be planned. Check truck availability, locations and delivery windows.": "تعذّر تخطيط أي رحلة. تحقق من توفر الشاحنات والمواقع وفترات التوصيل.",
        "depart": "مغادرة",
        "return": "عودة",
        "full": "ممتلئة",
        "arrival": "الوصول",
        "Copy for WhatsApp": "نسخ إلى WhatsApp",
        "Open in Google Maps": "افتح في خرائط Google",
        "Add map locations for your warehouse and stores to see them here.": "أضف مواقع المستودع والمتاجر لعرضها هنا.",
        "Planned delivery route map": "خريطة مسارات التوصيل المخططة",
        "No plan yet": "لا توجد خطة بعد",
        "Run sheets appear here after you plan routes.": "ستظهر جداول السائقين هنا بعد تخطيط المسارات.",
        "Go to Today’s plan": "انتقل إلى خطة اليوم",
        "Copy all run sheets": "نسخ كل جداول السائقين",
        "No trips in this plan": "لا توجد رحلات في هذه الخطة",
        "There are no driver run sheets for this shift.": "لا توجد جداول سائقين لهذه الوردية.",
        "How to use the planner": "كيفية استخدام المخطط",
        "Everything you need to set up the planner and run it each night.": "كل ما تحتاجه لإعداد المخطط وتشغيله كل ليلة.",
        "Guide sections": "أقسام الدليل",
        "First-time setup": "الإعداد لأول مرة",
        "Every night": "كل ليلة",
        "Reading the plan": "قراءة الخطة",
        "Sending to drivers": "إرسال المسارات للسائقين",
        "Adding a store": "إضافة متجر",
        "How routes are chosen": "كيفية اختيار المسارات",
        "Travel times": "أوقات الرحلات",
        "Team & data": "الفريق والبيانات",
        "Problems & fixes": "المشكلات والحلول",
        "First-time setup (about 15 minutes)": "الإعداد لأول مرة (حوالي ١٥ دقيقة)",
        "Open Google Maps, copy the warehouse coordinates, and paste them into Map location. A Google Maps link also works.": "افتح خرائط Google وانسخ إحداثيات المستودع والصقها في الموقع على الخريطة. يمكنك أيضًا استخدام رابط خرائط Google.",
        "Set the shift, loading and unloading times, and maximum trips.": "حدد الوردية وأوقات التحميل والتفريغ والحد الأقصى للرحلات.",
        "Add each truck with its number, type, pallet capacity and optional driver details.": "أضف كل شاحنة مع رقمها ونوعها وسعتها بالمنصات وبيانات السائق الاختيارية.",
        "Add your stores and set the two delivery windows. Windows can cross midnight.": "أضف متاجرك وحدد فترتي التوصيل. يمكن أن تمتد الفترات إلى ما بعد منتصف الليل.",
        "Upload a logo to replace the placeholder in the top bar.": "ارفع شعارًا ليحل محل الشعار الافتراضي في الشريط العلوي.",
        "Open Today’s plan and check the shift date.": "افتح خطة اليوم وتحقق من تاريخ الوردية.",
        "Tap a truck to leave it out (breakdown, no driver, maintenance).": "اضغط على الشاحنة لاستبعادها (عطل أو عدم توفر سائق أو صيانة).",
        "Enter frozen, chilled and ambient pallets staged in the warehouse.": "أدخل أعداد منصات البضائع المجمدة والمبردة والجافة المجهزة في المستودع.",
        "Enter pallets per store for slot 1 and slot 2. Use Excel template and Import orders to move orders with CSV.": "أدخل عدد المنصات لكل متجر في الفترتين الأولى والثانية. استخدم نموذج Excel واستيراد الطلبات لنقل الطلبات عبر CSV.",
        "Press Plan routes. Results are saved on this device with the date.": "اضغط «خطط المسارات». تُحفظ النتائج على هذا الجهاز مع التاريخ.",
        "If orders or fleet change after planning, press Re-plan.": "إذا تغيرت الطلبات أو الأسطول بعد التخطيط، اضغط «أعد التخطيط».",
        "Top tiles show trucks used, trips, average truck fill, planned pallets and estimated kilometres.": "تعرض المربعات العلوية الشاحنات المستخدمة والرحلات ومتوسط الامتلاء والمنصات المخططة والمسافة المقدرة.",
        "The map shows the warehouse and stop order by route colour; dashed lines show second trips.": "تعرض الخريطة المستودع وترتيب المحطات بلون كل مسار؛ وتمثل الخطوط المتقطعة الرحلات الثانية.",
        "Trip cards show loading/departure, stop arrival times, pallet mix and return time.": "تعرض بطاقات الرحلات وقت التحميل والمغادرة والوصول إلى المحطات ومزيج المنصات ووقت العودة.",
        "Not planned shows pallets that could not fit. Make another truck available or widen a delivery window.": "تعرض الطلبات غير المخططة المنصات التي تعذر تحميلها. أتح شاحنة أخرى أو وسّع فترة التوصيل.",
        "Open Driver run sheets to find each truck’s trips, stop order, arrival times and pallets per stop. Copy for WhatsApp copies a route summary; Open in Google Maps opens directions for each trip. Export to Excel saves a CSV file that opens in spreadsheet apps.": "افتح جداول السائقين لمعرفة رحلات كل شاحنة وترتيب المحطات وأوقات الوصول والمنصات في كل محطة. ينسخ زر WhatsApp ملخص المسار، ويفتح زر خرائط Google الاتجاهات، بينما يحفظ التصدير ملف CSV يمكن فتحه في برامج الجداول.",
        "Go to Stores and add a code, name, location and delivery windows. For a location, paste a Google Maps pin or coordinates like 30.0444, 31.2357. Pause stores by unticking Active. CSV import supports DS Code, Ds Name, Store location and optional slot window columns.": "انتقل إلى المتاجر وأضف الرمز والاسم والموقع وفترات التوصيل. للصق الموقع، استخدم رابط خرائط Google أو إحداثيات مثل 30.0444, 31.2357. أوقف المتجر بإلغاء تحديد «نشط». يدعم استيراد CSV أعمدة DS Code وDS Name وموقع المتجر وأوقات الفترات الاختيارية.",
        "The planner fills available truck capacity while keeping deliveries in their slot windows. Frozen/chilled trucks carry one cold temperature per trip plus ambient; dry trucks carry ambient only. Trips start and end at the warehouse.": "يملأ المخطط سعة الشاحنات المتاحة مع الالتزام بفترات التوصيل. تنقل شاحنات التبريد نوعًا واحدًا من البضائع الباردة مع الجافة، بينما تنقل الشاحنات الجافة بضائع جافة فقط. تبدأ الرحلات وتنتهي في المستودع.",
        "Road distance is straight-line distance multiplied by the Road factor. Driving time uses the average speed configured for that time of day. Adjust these estimates after comparing with real run times.": "تُحسب مسافة الطريق بضرب المسافة المباشرة في معامل الطريق. ويستخدم وقت القيادة متوسط السرعة المحدد لذلك الوقت من اليوم. عدّل التقديرات بعد مقارنتها بأوقات الرحلات الفعلية.",
        "This standalone copy stores its data in this browser and does not synchronize with other devices.": "تخزن هذه النسخة بياناتها في هذا المتصفح ولا تزامنها مع الأجهزة الأخرى.",
        "Each shift’s orders and plan are saved with the shift date.": "تُحفظ طلبات وخطة كل وردية مع تاريخها.",
        "Export your data as CSV when you need to share or archive it.": "صدّر بياناتك بصيغة CSV عند الحاجة إلى مشاركتها أو أرشفتها.",
        "“The slot closes before a truck can get there”: widen or move the slot, or check the store’s location.": "«تنتهي الفترة قبل وصول الشاحنة»: وسّع الفترة أو غيّر وقتها أو تحقق من موقع المتجر.",
        "“Not enough truck space or time”: make another truck available, allow more trips or move pallets to the other slot.": "«المساحة أو الوقت غير كافٍ»: أتح شاحنة أخرى أو اسمح برحلات أكثر أو انقل المنصات إلى الفترة الأخرى.",
        "A store shows “Missing” location: paste its Google Maps pin in Stores. Stores without a location cannot appear on the map.": "إذا ظهر الموقع «غير محدد»، فأضف رابط خرائط Google في صفحة المتاجر. لا يمكن عرض المتاجر دون موقع على الخريطة.",
        "Low fill often comes from narrow delivery windows. Wider windows let more stores share a truck.": "غالبًا ما ينتج انخفاض الامتلاء عن ضيق فترات التوصيل. تسمح الفترات الأوسع بتوصيل متاجر أكثر بالشاحنة نفسها.",
        "Your changes could not be saved in this browser. Check available storage.": "تعذّر حفظ التغييرات في هذا المتصفح. تحقق من مساحة التخزين المتاحة.",
        "Could not read the selected file.": "تعذّرت قراءة الملف المحدد.",
        "Could not import this file.": "تعذّر استيراد هذا الملف.",
        "Please choose a logo smaller than 2 MB.": "يرجى اختيار شعار يقل حجمه عن ٢ ميجابايت.",
        "A store with this code already exists.": "يوجد متجر بهذا الرمز بالفعل.",
        "A truck with this number already exists.": "توجد شاحنة بهذا الرقم بالفعل.",
        " store imported.": " متجر تم استيراده.",
        " stores imported.": " متاجر تم استيرادها.",
        " order row imported.": " صف طلب تم استيراده.",
        " order rows imported.": " صفوف طلبات تم استيرادها.",
        "Delivery slot ": "فترة التوصيل ",
        " may be missed": " قد لا يتم الالتزام بها",
        "Add the warehouse map location in Settings to improve distance estimates and route links.": "أضف موقع المستودع على الخريطة من الإعدادات لتحسين تقدير المسافة وروابط المسارات.",
        "Store added.": "تمت إضافة المتجر.",
        "Truck added.": "تمت إضافة الشاحنة.",
        "Clear all store orders for this shift?": "هل تريد مسح جميع طلبات المتاجر لهذه الوردية؟",
        "No saved orders were found for the previous day.": "لم يتم العثور على طلبات محفوظة لليوم السابق.",
        "Copied the previous day’s orders.": "تم نسخ طلبات اليوم السابق.",
        "All driver run sheets copied.": "تم نسخ جميع جداول السائقين.",
        "Run sheet copied.": "تم نسخ جدول السائق.",
        "Sample data is loaded. Replace it with your own stores and orders whenever you’re ready.": "تم تحميل بيانات نموذجية. استبدلها بمتاجرك وطلباتك عندما تكون جاهزًا.",
        "Run sheet": "جدول السائق",
        "No suitable truck available": "لا توجد شاحنة مناسبة",
        "No frozen/chilled truck available": "لا توجد شاحنة مجمدات/مبردات",
        "Not enough truck space or time": "مساحة الشاحنة أو الوقت غير كافٍ",
        "Reefer, cooling off": "شاحنة تبريد، التبريد متوقف",
      };
      const translationEntries = Object.entries(arabic).sort((a, b) => b[0].length - a[0].length);
      const originalText = new WeakMap<Node, string>();
      const originalAttributes = new WeakMap<Element, Map<string, string>>();
      function translateEnglish(text: string): string {
        return translationEntries.reduce((translated, [english, translatedText]) =>
          translated.split(english).join(translatedText), text);
      }
      function translateText(text: string): string {
        return language === "ar" ? translateEnglish(text) : text;
      }
      function applyLanguage(): void {
        document.documentElement.lang = language;
        document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
        const toggle = document.getElementById("languageToggle");
        if (toggle) {
          toggle.textContent = language === "ar" ? "English" : "العربية";
        }
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (!parent || parent.closest("script, style")) continue;
          const original = originalText.get(node) ?? node.nodeValue ?? "";
          originalText.set(node, original);
          node.nodeValue = translateText(original);
        }
        document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title], [alt]").forEach(element => {
          let originals = originalAttributes.get(element);
          if (!originals) {
            originals = new Map<string, string>();
            originalAttributes.set(element, originals);
          }
          ["placeholder", "aria-label", "title", "alt"].forEach(attribute => {
            const value = element.getAttribute(attribute);
            if (value) {
              const original = originals.get(attribute) ?? value;
              originals.set(attribute, original);
              element.setAttribute(attribute, translateText(original));
            }
          });
        });
        if (toggle) toggle.setAttribute("aria-label", language === "ar" ? "Switch language to English" : "التبديل إلى العربية");
      }
      const esc = (value: unknown): string => {
        const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(value ?? "").replace(/[&<>"']/g, char => replacements[char]);
      };
      const number = (value: unknown): number => Math.max(0, Number(value) || 0);
      const fmtDate = (date: string): string => new Date(date + "T12:00:00").toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
      function save() {
        try {
          localStorage.setItem(KEY, JSON.stringify(state));
          document.getElementById("saveDot")!.classList.add("saved");
          document.getElementById("saveText")!.textContent = translateText("Saved on this device");
        } catch (error) {
          document.getElementById("saveDot")!.classList.remove("saved");
          document.getElementById("saveText")!.textContent = translateText("Could not save");
          console.error("Could not save planner data.", error);
          message = "Your changes could not be saved in this browser. Check available storage.";
          messageIsError = true;
        }
      }
      function setMessage(text = "", isError = false) {
        message = text;
        messageIsError = isError;
        const element = document.querySelector(".notice-line");
        if (element) {
          element.textContent = translateText(text);
          element.classList.toggle("error", isError);
        }
      }
      function orderFor(storeId: string, slot: number): Order {
        return state.orders[`${storeId}:${slot}`] || { frozen: 0, chilled: 0, ambient: 0 };
      }
      function allOrderTotals(): PalletCounts {
        const totals: PalletCounts = { frozen: 0, chilled: 0, ambient: 0 };
        (["frozen", "chilled", "ambient"] as ProductType[]).forEach(type => {
          Object.values(state.orders).forEach(order => totals[type] += number(order[type]));
        });
        return totals;
      }
      function shiftLabel(): string {
        const d = new Date(state.date + "T12:00:00");
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return `${fmtDate(state.date)} ${state.settings.shiftStart} → ${fmtDate(localDateString(next))} ${state.settings.shiftEnd}`;
      }
      function refreshHeader(): void {
        document.getElementById("warehouseSubtitle")!.textContent = `${state.settings.warehouseName} · Ambient + Frozen/Chilled`;
        const logo = document.getElementById("brandLogo")!;
        logo.innerHTML = state.settings.logo ? `<img src="${esc(state.settings.logo)}" alt="Company logo">` : "minutes";
      }
      function notice(): string {
        return `<div class="notice"><strong>Not connected to shared storage.</strong> Changes are saved in this browser only, so your team won’t see them. Open the planner from its claude.ai link while signed in to share data.</div>`;
      }
      function pageHeading(title: string, subtitle = ""): string {
        return `<div class="page-heading"><div><h2>${title}</h2>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}</div></div>`;
      }
      function render(): void {
        refreshHeader();
        document.querySelectorAll<HTMLButtonElement>(".tab").forEach(tab => {
          const active = tab.dataset.tab === currentTab;
          tab.classList.toggle("active", active);
          tab.setAttribute("aria-selected", active ? "true" : "false");
        });
        const pages: Record<TabName, () => string> = {
          today: renderToday, routes: renderRoutes, drivers: renderDrivers,
          stores: renderStores, fleet: renderFleet, settings: renderSettings, guide: renderGuide
        };
        main.innerHTML = pages[currentTab]();
        if (message) {
          const line = main.querySelector(".notice-line");
          if (line) {
            line.textContent = message;
            line.classList.toggle("error", messageIsError);
          }
        }
        applyLanguage();
      }
      function truckCheckboxes(): string {
        if (!state.trucks.length) return `<div class="empty"><p>No trucks yet.</p><button class="btn" data-action="go-fleet">Add trucks</button></div>`;
        return `<div class="truck-grid">${state.trucks.map(truck => {
          const enabled = state.availability[truck.id] !== false;
          return `<label class="truck-toggle ${enabled ? "" : "off"}"><input type="checkbox" data-availability="${esc(truck.id)}" ${enabled ? "checked" : ""}><span><strong>${esc(truck.plate)}</strong><br><small class="muted">${truck.type === "reefer" ? "Frozen / Chilled" : "Dry"} · ${truck.capacity} pallets</small></span></label>`;
        }).join("")}</div>`;
      }
      function orderTable(): string {
        const stores = state.stores.filter(store => store.active !== false);
        if (!stores.length) return `<div class="empty"><h3>No stores yet</h3><p>Add stores or import them from Excel.</p><button class="btn" data-action="go-stores">Go to Stores</button></div>`;
        return `<div class="table-wrap"><table class="orders-table"><thead><tr><th>Store</th><th>Slot 1 · Frozen</th><th>Chilled</th><th>Ambient</th><th>Slot 2 · Frozen</th><th>Chilled</th><th>Ambient</th></tr></thead><tbody>${stores.map(store => {
          const a = orderFor(store.id, 1), b = orderFor(store.id, 2);
          return `<tr><td class="store-cell"><strong>${esc(store.code)} · ${esc(store.name)}</strong><span class="order-sub">${esc(store.slot1From || "No slot")}–${esc(store.slot1To || "")} / ${esc(store.slot2From || "No slot")}–${esc(store.slot2To || "")}</span></td>${(["frozen","chilled","ambient"] as ProductType[]).map(type => `<td><input aria-label="${esc(store.name)} slot 1 ${type}" data-order="${esc(store.id)}:1:${type}" type="number" min="0" step="1" value="${number(a[type])}"></td>`).join("")}${(["frozen","chilled","ambient"] as ProductType[]).map(type => `<td><input aria-label="${esc(store.name)} slot 2 ${type}" data-order="${esc(store.id)}:2:${type}" type="number" min="0" step="1" value="${number(b[type])}"></td>`).join("")}</tr>`;
        }).join("")}</tbody></table></div>`;
      }
      function renderToday(): string {
        const totals = allOrderTotals();
        return `${notice()}<div class="page-heading"><div><h2>Tonight’s dispatch</h2><p class="subtitle">${esc(shiftLabel())}</p></div><div class="date-wrap"><label for="shiftDate">Shift date</label><input id="shiftDate" type="date" value="${esc(state.date)}"></div></div>
          ${(!state.settings.warehouseLocation || !state.trucks.length) ? `<div class="before-plan"><strong>Before you plan</strong><ul>${!state.settings.warehouseLocation ? `<li>Set the warehouse map location in <a href="#" data-action="go-settings">Settings</a>.</li>` : ""}${!state.trucks.length ? `<li>Add your trucks in <a href="#" data-action="go-fleet">Fleet</a>. Until then you can <a href="#" data-action="sample">try a sample plan</a> using your stores and made-up trucks and orders.</li>` : ""}</ul></div>` : ""}
          <div class="split">
            <section class="card"><div class="card-header"><div><h3>1 · Trucks available tonight</h3><p>Tap a truck to take it out of tonight’s plan. Each truck can run up to ${number(state.settings.maxTrips)} trips between ${esc(state.settings.shiftStart)} and ${esc(state.settings.shiftEnd)}.</p></div></div>${truckCheckboxes()}</section>
            <section class="card"><div class="card-header"><div><h3>2 · Pallets ready to dispatch</h3><p>What the warehouse has picked and staged. The planner checks it against the store orders below.</p></div></div>
              <div class="pallet-inputs">${(["frozen","chilled","ambient"] as ProductType[]).map(type => `<label class="field"><span>${type[0].toUpperCase()+type.slice(1)} pallets</span><input type="number" min="0" data-pallet="${type}" value="${number(state.pallets[type])}"></label>`).join("")}</div>
              <div class="order-totals">${(["frozen","chilled","ambient"] as ProductType[]).map(type => `<span class="pill"><strong>${type[0].toUpperCase()+type.slice(1)}</strong> ${totals[type]} ordered</span>`).join("")}</div>
            </section>
          </div>
          <section class="card" style="margin-top:18px"><div class="card-header"><div><h3>3 · Store orders by delivery slot</h3></div><div class="toolbar"><button class="btn small" data-action="copy-day">Copy last saved day</button><button class="btn small" data-action="template">Excel template</button><button class="btn small" data-action="import-orders">Import orders</button><button class="btn small danger" data-action="clear-orders">Clear</button><input id="ordersFile" class="hidden" type="file" accept=".csv,text/csv"></div></div>
            <p class="muted">Enter pallets per store for each slot. A store gets a second delivery only if you put pallets in slot 2. Frozen and chilled must go on frozen/chilled trucks; ambient can ride on any truck.</p>
            ${orderTable()}
          </section>
          <div class="plan-footer"><p>${state.stores.length ? "Review the orders, then build the night’s routes." : "Enter store orders to plan."}</p><button class="btn primary" data-action="plan">Plan routes →</button></div><div class="notice-line" role="status"></div>`;
      }
      function renderStores(): string {
        return `${notice()}<div class="card-header" style="margin-top:24px"><div>${pageHeading("Stores", `${state.stores.length} stores. Paste a Google Maps link, “lat, lng”, or the degrees format from your sheet into Location. Times save as you type.`)}</div><div class="toolbar"><button class="btn" data-action="import-stores">Import from Excel</button><input id="storesFile" class="hidden" type="file" accept=".csv,text/csv"></div></div>
          <section class="card"><div class="card-header"><div><h3>Add a store</h3></div></div><form id="storeForm"><div class="form-grid">
            <label class="field"><span>Store code</span><input name="code" placeholder="CAIDS33" required></label>
            <label class="field"><span>Store name</span><input name="name" required></label>
            <label class="field"><span>Location (Google Maps link or lat, lng)</span><input name="location" placeholder="https://maps.google.com/... or 30.0444, 31.2357"></label>
            <label class="field"><span>Slot 1 from</span><input name="slot1From" type="time"></label>
            <label class="field"><span>Slot 1 to</span><input name="slot1To" type="time"></label>
            <label class="field"><span>Slot 2 from</span><input name="slot2From" type="time"></label>
            <label class="field"><span>Slot 2 to</span><input name="slot2To" type="time"></label>
          </div><div class="form-actions"><button class="btn primary" type="submit">Add store</button></div></form><div class="notice-line" role="status"></div></section>
          ${state.stores.length ? `<section class="card"><div class="card-header"><div><h3>Store list</h3></div></div><div class="table-wrap"><table><thead><tr><th>Store</th><th>Location</th><th>Slot 1</th><th>Slot 2</th><th>Status</th><th></th></tr></thead><tbody>${state.stores.map(store => `<tr><td><strong>${esc(store.code)} · ${esc(store.name)}</strong></td><td>${store.coords ? `${store.coords.lat.toFixed(4)}, ${store.coords.lng.toFixed(4)}` : `<span class="status-tag missing">Missing</span>`}</td><td>${esc(store.slot1From || "—")}–${esc(store.slot1To || "—")}</td><td>${esc(store.slot2From || "—")}–${esc(store.slot2To || "—")}</td><td><label><input type="checkbox" data-store-active="${esc(store.id)}" ${store.active === false ? "" : "checked"}> Active</label></td><td><button class="btn small danger" data-delete-store="${esc(store.id)}">Delete</button></td></tr>`).join("")}</tbody></table></div></section>` : `<div class="map-empty">Nothing to show on the map yet.</div>`}`;
      }
      function renderFleet(): string {
        const reefer = state.trucks.filter(truck => truck.type === "reefer").length;
        return `${notice()}<section class="card" style="margin-top:24px"><div class="card-header"><div><h2>Fleet</h2><p>${state.trucks.length} trucks: ${reefer} frozen/chilled, ${state.trucks.length-reefer} dry. Capacity is in pallets. Frozen/chilled trucks have a movable separator: one cold temperature (frozen or chilled) plus ambient on each trip, or ambient only with the unit off.</p></div></div>
          <div class="card"><h3>Add a truck</h3><form id="truckForm"><div class="form-grid">
            <label class="field"><span>Truck number / plate</span><input name="plate" placeholder="e.g. 1234 ABC" required></label>
            <label class="field"><span>Type</span><select name="type"><option value="reefer">Frozen / Chilled</option><option value="dry">Dry</option></select></label>
            <label class="field"><span>Capacity (pallets)</span><input name="capacity" type="number" min="1" step="1" value="10" required></label>
            <label class="field"><span>Driver</span><input name="driver" placeholder="Optional"></label>
            <label class="field"><span>Driver phone</span><input name="phone" type="tel" placeholder="Optional"></label>
          </div><div class="form-actions"><button class="btn primary" type="submit">Add truck</button></div></form><div class="notice-line" role="status"></div></div>
          ${state.trucks.length ? `<div class="table-wrap" style="margin-top:20px"><table><thead><tr><th>Truck</th><th>Type</th><th>Capacity</th><th>Driver</th><th>Phone</th><th></th></tr></thead><tbody>${state.trucks.map(truck => `<tr><td><strong>${esc(truck.plate)}</strong></td><td>${truck.type === "reefer" ? "Frozen / Chilled" : "Dry"}</td><td>${truck.capacity} pallets</td><td>${esc(truck.driver || "—")}</td><td>${esc(truck.phone || "—")}</td><td><button class="btn small danger" data-delete-truck="${esc(truck.id)}">Delete</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty" style="margin-top:20px"><h3>No trucks yet</h3><p>Add your trucks above. You choose which ones are available each night on Today’s plan.</p></div>`}</section>`;
      }
      function renderSettings(): string {
        const s = state.settings;
        return `${notice()}${pageHeading("Settings", "These rules apply to every plan. Changes save automatically.")}<section class="card"><h3>Warehouse</h3><p class="muted">Both the ambient and the frozen/chilled warehouse are on this site, so every trip starts and ends here.</p>
          <div class="form-grid two"><label class="field"><span>Name</span><input data-setting="warehouseName" value="${esc(s.warehouseName)}"></label><label class="field"><span>Map location (Google Maps link or lat, lng)</span><input data-setting="warehouseLocation" placeholder="Paste the warehouse pin" value="${esc(s.warehouseLocation)}"></label></div>
          <div class="notice-line">${s.warehouseLocation ? "Location set" : "Location missing"}</div></section>
          <section class="card"><h3>Shift &amp; handling times</h3><div class="form-grid">
            ${settingInput("Trucks available from","shiftStart",s.shiftStart,"time")}${settingInput("Trucks back by","shiftEnd",s.shiftEnd,"time")}
            ${settingInput("Loading per trip (min)","loadMinutes",s.loadMinutes,"number")}${settingInput("Unloading per stop (min)","stopMinutes",s.stopMinutes,"number")}${settingInput("Unloading per pallet (min)","palletMinutes",s.palletMinutes,"number")}${settingInput("Max trips per truck","maxTrips",s.maxTrips,"number")}
          </div></section>
          <section class="card"><h3>Travel time estimate</h3><p class="muted">Road distance = straight-line distance × road factor. Driving time uses the speed for the time a truck leaves each stop, to reflect Cairo traffic.</p>
            <div class="form-grid two">${settingInput("Road factor","roadFactor",s.roadFactor,"number","0.1")}${settingInput("Planning effort (tries)","planningEffort",s.planningEffort,"number")}</div>
            <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Until</th><th>Average speed (km/h)</th></tr></thead><tbody>${s.speeds.map((speed,i)=>`<tr><td><input type="time" data-speed-time="${i}" value="${esc(speed.until)}"></td><td><input type="number" min="1" data-speed-value="${i}" value="${number(speed.speed)}"></td></tr>`).join("")}</tbody></table></div>
          </section>
          <section class="card"><h3>Brand logo</h3><p class="muted">Upload your logo (PNG, JPG, SVG or WebP). It replaces the placeholder in the top bar on this device.</p><div class="row-title"><div class="logo">minutes</div><button class="btn" data-action="upload-logo">Upload logo</button><input id="logoFile" class="hidden" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"></div></section>`;
      }
      function settingInput(
        label: string,
        key: keyof PlannerSettings,
        value: string | number,
        type: "time" | "number",
        step = "1"
      ): string {
        return `<label class="field"><span>${label}</span><input data-setting="${key}" type="${type}" ${type==="number" ? `min="0" step="${step}"` : ""} value="${esc(value)}"></label>`;
      }
      function renderRoutes(): string {
        const plan = state.plan;
        return `${notice()}${pageHeading("Routes &amp; map", esc(shiftLabel()))}${!plan ? `<section class="card"><div class="empty"><h3>No plan for this shift yet</h3><p>Pick tonight’s trucks and enter store orders on Today’s plan, then press Plan routes.</p><button class="btn" data-action="go-today">Enter orders</button><button class="btn" data-action="sample">Try a sample plan</button></div></section><div class="map-empty">Nothing to show on the map yet.</div>` : `${plan.outdated ? `<div class="notice"><strong>Plan out of date.</strong> Your orders or fleet changed. Re-plan to refresh these routes.</div>` : ""}${planStats(plan)}<div class="split"><section class="card"><h3>Routes &amp; map</h3>${mapSvg(plan)}</section><section class="card"><h3>Planned trips</h3>${tripCards(plan)}</section></div>${plan.unplanned.length ? `<section class="card"><h3>Not planned</h3><ul>${plan.unplanned.map(item=>`<li>${esc(item.store)} · ${item.quantity} ${esc(item.type)} — ${esc(item.reason)}</li>`).join("")}</ul></section>` : ""}<div class="toolbar" style="margin-top:16px"><button class="btn" data-action="export-plan">Export to Excel</button><button class="btn primary" data-action="plan">Re-plan</button></div><div class="notice-line"></div>`}`;
      }
      function planStats(plan: Plan): string {
        const used = new Set(plan.trips.map(trip=>trip.truckId)).size;
        const pallets = plan.trips.reduce((sum,trip)=>sum+trip.load,0);
        const km = plan.trips.reduce((sum,trip)=>sum+trip.km,0);
        return `<div class="stats"><div class="stat"><strong>${used}/${plan.available}</strong><span>Trucks used</span></div><div class="stat"><strong>${plan.trips.length}</strong><span>Trips</span></div><div class="stat"><strong>${plan.trips.length ? Math.round(plan.trips.reduce((s,t)=>s+t.fill,0)/plan.trips.length) : 0}%</strong><span>Average fill</span></div><div class="stat"><strong>${pallets}</strong><span>Pallets planned</span></div><div class="stat"><strong>${km.toFixed(1)} km</strong><span>Estimated km</span></div></div>`;
      }
      function tripCards(plan: Plan): string {
        if (!plan.trips.length) return `<p class="muted">No trips could be planned. Check truck availability, locations and delivery windows.</p>`;
        return `<div class="trip-list">${plan.trips.map((trip,index)=>`<article class="trip-card" style="border-left:5px solid ${trip.color}"><div class="trip-card-head"><div><h3>${esc(trip.truck)} · Trip ${trip.number}</h3><div class="trip-meta">${esc(trip.mode)} · ${esc(trip.depart)} depart · ${esc(trip.returnAt)} return · ${trip.km.toFixed(1)} km</div></div><span class="status-tag">${trip.fill}% full</span></div>${trip.stops.map((stop,i)=>`<div class="stop-row"><span class="stop-number">${i+1}</span><div><strong>${esc(stop.store)}</strong><div class="trip-meta">${esc(stop.arrive)} arrival${stop.slot ? ` · slot ${esc(stop.slot)}` : ""} · ${stop.items.map(item=>`${item.count} ${item.type[0].toUpperCase()}`).join(", ")}</div></div><strong>${stop.load} pallets</strong></div>`).join("")}<div class="fill-bar">${trip.parts.map(part=>`<span style="width:${Math.min(100,part.percent)}%;background:${part.color}"></span>`).join("")}</div><div class="toolbar" style="margin-top:12px"><button class="btn small" data-action="copy-trip" data-trip="${index}">Copy for WhatsApp</button><a class="btn small" target="_blank" rel="noopener" href="${esc(trip.mapUrl)}">Open in Google Maps</a></div></article>`).join("")}</div>`;
      }
      function mapSvg(plan: Plan): string {
        if (!plan.trips.length) return `<div class="map-empty">Nothing to show on the map yet.</div>`;
        const coords = plan.trips.flatMap(t=>t.stops.map(s=>s.coords).filter((coordinate): coordinate is Coordinates => coordinate !== null));
        const warehouse = parseLocation(state.settings.warehouseLocation);
        if (!coords.length) return `<div class="map-empty">Add map locations for your warehouse and stores to see them here.</div>`;
        const all = warehouse ? [...coords,warehouse] : coords;
        const minLat = Math.min(...all.map(c=>c.lat)), maxLat = Math.max(...all.map(c=>c.lat));
        const minLng = Math.min(...all.map(c=>c.lng)), maxLng = Math.max(...all.map(c=>c.lng));
        const point = (c: Coordinates) => ({ x: 45 + (maxLng===minLng ? .5 : (c.lng-minLng)/(maxLng-minLng)) * 510, y: 370 - (maxLat===minLat ? .5 : (c.lat-minLat)/(maxLat-minLat)) * 320 });
        const warehousePoint = point(warehouse || {lat:(minLat+maxLat)/2,lng:(minLng+maxLng)/2});
        const lines = plan.trips.map(trip=>{
          const points=[warehousePoint,...trip.stops.map(stop=>stop.coords).filter((coordinate): coordinate is Coordinates => coordinate !== null).map(point),warehousePoint];
          return `<polyline points="${points.map(p=>`${p.x},${p.y}`).join(" ")}" fill="none" stroke="${trip.color}" stroke-width="3" stroke-dasharray="${trip.number>1?"7 6":"0"}" opacity=".8"/>`;
        }).join("");
        const markers = plan.trips.flatMap(trip=>trip.stops.map((stop,i)=>{
          if(!stop.coords)return "";
          const p=point(stop.coords);
          return `<g><circle cx="${p.x}" cy="${p.y}" r="13" fill="${trip.color}" stroke="white" stroke-width="3"/><text x="${p.x}" y="${p.y+4}" text-anchor="middle" fill="white" font-size="11" font-weight="bold">${i+1}</text></g>`;
        })).join("");
        return `<div class="map-panel"><svg viewBox="0 0 600 420" role="img" aria-label="Planned delivery route map"><rect width="600" height="420" fill="#f6f8fb"/><path d="M0 80 Q130 120 250 74 T600 93 M0 300 Q180 245 300 305 T600 277 M160 0 Q190 120 175 240 T220 420 M440 0 Q400 130 465 220 T430 420" fill="none" stroke="#e5eaf0" stroke-width="3"/>${lines}<rect x="${warehousePoint.x-12}" y="${warehousePoint.y-12}" width="24" height="24" rx="4" fill="#ffe52f" stroke="#333" stroke-width="2"/><text x="${warehousePoint.x+17}" y="${warehousePoint.y+4}" font-size="12" font-weight="bold" fill="#333">Warehouse</text>${markers}<g transform="translate(16 388)">${plan.trips.map((trip,i)=>`<text x="${(i%3)*178}" y="${Math.floor(i/3)*17}" font-size="11" fill="#333">● <tspan fill="${trip.color}">${esc(trip.truck)} / ${trip.number}</tspan></text>`).join("")}</g></svg></div>`;
      }
      function renderDrivers(): string {
        if (!state.plan) return `<section class="card" style="margin-top:24px">${pageHeading("Driver run sheets")}<div class="empty"><h3>No plan yet</h3><p>Run sheets appear here after you plan routes.</p><button class="btn" data-action="go-today">Go to Today’s plan</button></div></section>`;
        return `${pageHeading("Driver run sheets", esc(shiftLabel()))}${state.plan.trips.length ? `<div class="toolbar" style="margin-bottom:14px"><button class="btn" data-action="copy-all">Copy all run sheets</button></div>${tripCards(state.plan)}` : `<div class="empty"><h3>No trips in this plan</h3><p>There are no driver run sheets for this shift.</p></div>`}<div class="notice-line"></div>`;
      }
      function renderGuide(): string {
        return `${pageHeading("How to use the planner", "Everything you need to set up the planner and run it each night.")}<div class="guide-layout"><nav class="guide-nav" aria-label="Guide sections">${[["setup","First-time setup"],["daily","Every night"],["read","Reading the plan"],["drivers","Sending to drivers"],["stores","Adding a store"],["rules","How routes are chosen"],["travel","Travel times"],["team","Team & data"],["faq","Problems & fixes"]].map(([id,label])=>`<a href="#g-${id}">${label}</a>`).join("")}</nav><article class="guide-article">
          <section id="g-setup"><h3>First-time setup (about 15 minutes)</h3><ol><li>Settings → Warehouse. Open Google Maps, copy the warehouse coordinates, and paste them into Map location. A Google Maps link also works.</li><li>Settings → Shift &amp; handling. Set the shift, loading and unloading times, and maximum trips.</li><li>Fleet. Add each truck with its number, type, pallet capacity and optional driver details.</li><li>Stores. Add your stores and set the two delivery windows. Windows can cross midnight.</li><li>Settings → Brand logo. Upload a logo to replace the placeholder in the top bar.</li></ol></section>
          <section id="g-daily"><h3>Every night</h3><ol><li>Open Today’s plan and check the shift date.</li><li>Tap a truck to leave it out (breakdown, no driver, maintenance).</li><li>Enter frozen, chilled and ambient pallets staged in the warehouse.</li><li>Enter pallets per store for slot 1 and slot 2. Use Excel template and Import orders to move orders with CSV.</li><li>Press Plan routes. Results are saved on this device with the date.</li><li>If orders or fleet change after planning, press Re-plan.</li></ol></section>
          <section id="g-read"><h3>Reading the plan</h3><ul><li>Top tiles show trucks used, trips, average truck fill, planned pallets and estimated kilometres.</li><li>The map shows the warehouse and stop order by route colour; dashed lines show second trips.</li><li>Trip cards show loading/departure, stop arrival times, pallet mix and return time.</li><li>Not planned shows pallets that could not fit. Make another truck available or widen a delivery window.</li></ul></section>
          <section id="g-drivers"><h3>Sending to drivers</h3><p>Open Driver run sheets to find each truck’s trips, stop order, arrival times and pallets per stop. Copy for WhatsApp copies a route summary; Open in Google Maps opens directions for each trip. Export to Excel saves a CSV file that opens in spreadsheet apps.</p></section>
          <section id="g-stores"><h3>Adding a store</h3><p>Go to Stores and add a code, name, location and delivery windows. For a location, paste a Google Maps pin or coordinates like 30.0444, 31.2357. Pause stores by unticking Active. CSV import supports DS Code, Ds Name, Store location and optional slot window columns.</p></section>
          <section id="g-rules"><h3>How routes are chosen</h3><p>The planner fills available truck capacity while keeping deliveries in their slot windows. Frozen/chilled trucks carry one cold temperature per trip plus ambient; dry trucks carry ambient only. Trips start and end at the warehouse.</p></section>
          <section id="g-travel"><h3>Travel times</h3><p>Road distance is straight-line distance multiplied by the Road factor. Driving time uses the average speed configured for that time of day. Adjust these estimates after comparing with real run times.</p></section>
          <section id="g-team"><h3>Team &amp; data</h3><ul><li>This standalone copy stores its data in this browser and does not synchronize with other devices.</li><li>Each shift’s orders and plan are saved with the shift date.</li><li>Export your data as CSV when you need to share or archive it.</li></ul></section>
          <section id="g-faq"><h3>Problems &amp; fixes</h3><ul><li>“The slot closes before a truck can get there”: widen or move the slot, or check the store’s location.</li><li>“Not enough truck space or time”: make another truck available, allow more trips or move pallets to the other slot.</li><li>A store shows “Missing” location: paste its Google Maps pin in Stores. Stores without a location cannot appear on the map.</li><li>Low fill often comes from narrow delivery windows. Wider windows let more stores share a truck.</li></ul></section>
        </article></div>`;
      }
      function parseLocation(value: string): Coordinates | null {
        const text = String(value || "").trim();
        if (!text) return null;
        const patterns = [
          /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
          /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
          /(-?\d{1,2}\.\d+)\s*[,;]\s*(-?\d{1,3}\.\d+)/
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const lat = Number(match[1]), lng = Number(match[2]);
            if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
          }
        }
        return null;
      }
      function minutesOf(time: string, relativeTo = state.settings.shiftStart): number {
        if (!time || !/^\d{2}:\d{2}$/.test(time)) return 0;
        const [hour, minute] = time.split(":").map(Number);
        let value = hour * 60 + minute;
        const [startHour, startMinute] = relativeTo.split(":").map(Number);
        const start = startHour * 60 + startMinute;
        if (value < start) value += 1440;
        return value;
      }
      function showTime(value: number): string {
        const minutes = ((Math.round(value) % 1440) + 1440) % 1440;
        return `${String(Math.floor(minutes / 60)).padStart(2,"0")}:${String(minutes % 60).padStart(2,"0")}`;
      }
      function distance(a: Coordinates, b: Coordinates): number {
        const toRad = (degrees: number) => degrees * Math.PI / 180;
        const dLat = toRad(b.lat-a.lat), dLng = toRad(b.lng-a.lng);
        const v = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
        return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1-v));
      }
      function speedAt(minutes: number): number {
        const speeds = state.settings.speeds;
        const clock = ((minutes % 1440) + 1440) % 1440;
        const ordered = speeds.map(row=>({until:(Number(row.until.slice(0,2))*60+Number(row.until.slice(3))),speed:number(row.speed)})).sort((a,b)=>a.until-b.until);
        return (ordered.find(row=>clock <= row.until) || ordered[ordered.length-1] || {speed:40}).speed || 40;
      }
      const colors: string[] = ["#3979d6","#20a58d","#e7a629","#c65469","#7658b6","#528b48","#df7042","#508a9c"];
      function buildPlan(): Plan {
        const warehouse = parseLocation(state.settings.warehouseLocation);
        const stores = state.stores.filter(store=>store.active !== false);
        const available = state.trucks.filter(truck=>state.availability[truck.id] !== false);
        const totals = allOrderTotals();
        const stock: PalletCounts = { frozen:number(state.pallets.frozen), chilled:number(state.pallets.chilled), ambient:number(state.pallets.ambient) };
        const unplanned: UnplannedOrder[] = [];
        const demands: Demand[] = [];
        for (const store of stores) {
          for (const slot of [1,2]) {
            const order = orderFor(store.id,slot);
            for (const type of ["frozen","chilled","ambient"] as ProductType[]) {
              let quantity = number(order[type]);
              if (!quantity) continue;
              const staged = Math.min(quantity,stock[type]);
              stock[type] -= staged;
              if (staged < quantity) unplanned.push({store:store.name,quantity:quantity-staged,type,reason:"Not enough pallets staged at the warehouse"});
              if (staged) demands.push({store,slot,type,quantity:staged});
            }
          }
        }
        const trips: PlannedTrip[] = [];
        const truckRunCount: Record<string, number> = {};
        const truckLastReturn: Record<string, number> = {};
        const shiftStart = minutesOf(state.settings.shiftStart);
        const shiftEnd = minutesOf(state.settings.shiftEnd);
        const maxTrips = Math.max(1,number(state.settings.maxTrips) || 1);
        const groups = new Map<string, Demand[]>();
        demands.forEach(demand=>{
          const key = `${demand.slot}:${demand.type}`;
          if (!groups.has(key)) groups.set(key,[]);
          groups.get(key)!.push(demand);
        });
        for (const [, group] of groups) {
          group.sort((a,b)=>minutesOf(slotStart(a.store,a.slot))-minutesOf(slotStart(b.store,b.slot)));
          let batch: Demand[] = [], capacity = 0;
          const flush = () => {
            if (!batch.length) return;
            const firstDemand = batch[0];
            if (!firstDemand) return;
            const cold = firstDemand.type !== "ambient";
            const truckCandidates = available.filter(truck=>(!cold || truck.type==="reefer") && number(truck.capacity)>0);
            const remaining: Demand[] = batch.map(item=>({...item}));
            let safety = 0;
            while (remaining.some(item=>item.quantity>0) && safety++ < 500) {
              const candidate = truckCandidates.filter(truck=>(truckRunCount[truck.id]||0)<maxTrips)
                .sort((a,b)=>(truckLastReturn[a.id]||shiftStart)-(truckLastReturn[b.id]||shiftStart))[0];
              if (!candidate) {
                remaining.filter(item=>item.quantity>0).forEach(item=>unplanned.push({store:item.store.name,quantity:item.quantity,type:item.type,reason:"Not enough truck space or time"}));
                break;
              }
              const tripCapacity=number(candidate.capacity);
              let left=tripCapacity;
              const assigned: AssignedDemand[]=[];
              for (const item of remaining) {
                if (item.quantity<=0 || left<=0) continue;
                const count=Math.min(item.quantity,left);
                assigned.push({store:item.store,slot:item.slot,type:item.type,count});
                item.quantity-=count;
                left-=count;
              }
              if (!assigned.length) break;
              const tripNumber=(truckRunCount[candidate.id]||0)+1;
              const base=Math.max(shiftStart,truckLastReturn[candidate.id]||shiftStart);
              let current=base+number(state.settings.loadMinutes);
              let km=0,previous=warehouse,stops=[];
              const byStore=new Map<string, StopDraft>();
              assigned.forEach(item=>{
                let stop=byStore.get(item.store.id);
                if(!stop){stop={store:item.store,slot:item.slot,items:[],load:0};byStore.set(item.store.id,stop);}
                stop.items.push({type:item.type,count:item.count}); stop.load+=item.count;
              });
              const ordered: StopDraft[]=[...byStore.values()].sort((a,b)=>{
                const ta=minutesOf(slotStart(a.store,a.slot)||state.settings.shiftStart);
                const tb=minutesOf(slotStart(b.store,b.slot)||state.settings.shiftStart);
                if(ta!==tb)return ta-tb;
                if(previous && a.store.coords && b.store.coords) return distance(previous,a.store.coords)-distance(previous,b.store.coords);
                return a.store.name.localeCompare(b.store.name);
              });
              for(let stopIndex=0;stopIndex<ordered.length;stopIndex++) {
                const stop=ordered[stopIndex];
                const coords=stop.store.coords||warehouse;
                let leg=0;
                let driveMinutes=0;
                if(previous && coords){leg=distance(previous,coords)*number(state.settings.roadFactor||1.3);driveMinutes=leg/(speedAt(current)||40)*60;}
                const from=slotStart(stop.store,stop.slot), to=slotEnd(stop.store,stop.slot);
                const earliest=from?minutesOf(from):shiftStart;
                const arrival=Math.max(current+driveMinutes,earliest);
                if(to && arrival>minutesOf(to)) {
                  ordered.slice(stopIndex).forEach(missed=>unplanned.push({store:missed.store.name,quantity:missed.load,type:firstDemand.type,reason:`Delivery slot ${missed.slot} may be missed`}));
                  break;
                }
                km+=leg;
                current=arrival;
                stops.push({store:`${stop.store.code} · ${stop.store.name}`,coords:stop.store.coords,arrive:showTime(current),slot:stop.slot,items:stop.items,load:stop.load});
                current+=number(state.settings.stopMinutes)+stop.load*number(state.settings.palletMinutes);
                previous=coords||previous;
              }
              if(!stops.length) {
                remaining.filter(item=>item.quantity>0).forEach(item=>unplanned.push({store:item.store.name,quantity:item.quantity,type:item.type,reason:"Not enough truck space or time"}));
                break;
              }
              if(previous && warehouse){const leg=distance(previous,warehouse)*number(state.settings.roadFactor||1.3);km+=leg;current+=leg/(speedAt(current)||40)*60;}
              const returnAt=current;
              if(returnAt>shiftEnd) {
                assigned.forEach(item=>unplanned.push({store:item.store.name,quantity:item.count,type:item.type,reason:"Not enough truck space or time"}));
                break;
              }
              const load=stops.reduce((sum,stop)=>sum+stop.load,0);
              const loadTypes: TripItem[]=(["frozen","chilled","ambient"] as ProductType[]).map(type=>({type,count:stops.flatMap(stop=>stop.items).filter(item=>item.type===type).reduce((sum,item)=>sum+item.count,0)})).filter(item=>item.count);
              const fill=Math.round(load/tripCapacity*100);
              const mode=cold ? (firstDemand.type[0].toUpperCase()+firstDemand.type.slice(1)) : candidate.type==="reefer" ? "Reefer, cooling off" : "Ambient";
              const mapStops=stops.filter((stop): stop is PlannedStop & {coords: Coordinates} => stop.coords !== null);
              const mapUrl=warehouse && mapStops.length ? `https://www.google.com/maps/dir/${warehouse.lat},${warehouse.lng}/${mapStops.map(stop=>`${stop.coords.lat},${stop.coords.lng}`).join("/")}/${warehouse.lat},${warehouse.lng}` : `https://www.google.com/maps/dir/${mapStops.map(stop=>`${stop.coords.lat},${stop.coords.lng}`).join("/")}`;
              trips.push({truck:candidate.plate,truckId:candidate.id,number:tripNumber,mode,depart:showTime(base),returnAt:showTime(returnAt),km,load,fill,capacity:tripCapacity,stops,items:loadTypes,color:colors[available.indexOf(candidate)%colors.length],parts:loadTypes.map(item=>({percent:item.count/load*100,color:{frozen:"#3979d6",chilled:"#20a58d",ambient:"#e7a629"}[item.type]})),mapUrl});
              truckRunCount[candidate.id]=tripNumber;
              truckLastReturn[candidate.id]=returnAt;
            }
            batch=[];
          };
          for(const demand of group) {
            const cold=demand.type!=="ambient";
            const maxTruck=available.filter(truck=>(!cold||truck.type==="reefer")).reduce((max,truck)=>Math.max(max,number(truck.capacity)),0);
            if(maxTruck===0) {
              unplanned.push({store:demand.store.name,quantity:demand.quantity,type:demand.type,reason:cold?"No frozen/chilled truck available":"No suitable truck available"});
              continue;
            }
            let left=demand.quantity;
            while(left>0) {
              const amount=Math.min(left,maxTruck);
              if(batch.length && capacity+amount>maxTruck){flush();capacity=0;}
              batch.push({...demand,quantity:amount}); capacity+=amount; left-=amount;
              if(capacity>=maxTruck){flush();capacity=0;}
            }
          }
          flush();
        }
        if(!warehouse && trips.length) message="Add the warehouse map location in Settings to improve distance estimates and route links.";
        const plan={date:state.date,trips,unplanned,available:available.length,totals};
        state.plan=plan;
        save();
        return plan;
      }
      function csvCell(value: unknown): string { return `"${String(value ?? "").replace(/"/g,'""')}"`; }
      function download(name: string,content: string,type="text/csv;charset=utf-8"): void {
        const blob=new Blob(["\ufeff",content],{type});
        const link=document.createElement("a");
        link.href=URL.createObjectURL(blob); link.download=name; link.click();
        setTimeout(()=>URL.revokeObjectURL(link.href),1000);
      }
      function parseCsv(text: string): string[][] {
        const rows=[]; let row=[],cell="",quoted=false;
        for(let i=0;i<text.length;i++){
          const char=text[i];
          if(quoted && char==='"' && text[i+1]==='"'){cell+='"';i++;}
          else if(char==='"') quoted=!quoted;
          else if(char==="," && !quoted){row.push(cell);cell="";}
          else if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell="";}
          else cell+=char;
        }
        row.push(cell); if(row.some(value=>value.trim()))rows.push(row);
        if(quoted) throw new Error("The CSV file has an unclosed quoted field.");
        return rows;
      }
      const norm = (value: unknown): string => String(value||"").toLowerCase().replace(/[^a-z0-9]/g,"");
      function importStores(text: string): void {
        const rows=parseCsv(text);
        if(rows.length<2) throw new Error("The file needs a header row and at least one store.");
        const header=rows[0].map(norm);
        const find=(row: string[],...keys: string[]): string => {const i=keys.map(key=>header.indexOf(norm(key))).find(index=>index>=0);return i==null?"":row[i]||"";};
        let count=0;
        rows.slice(1).forEach(row=>{
          const code=find(row,"DS Code","Store code","Code"),name=find(row,"DS Name","Store name","Name");
          if(!code||!name)return;
          const old=state.stores.find(store=>store.code.toLowerCase()===code.toLowerCase());
          const store={id:old?.id||crypto.randomUUID(),code,name,location:find(row,"Store location","Location"),coords:parseLocation(find(row,"Store location","Location")),slot1From:find(row,"Slot 1 From"),slot1To:find(row,"Slot 1 To"),slot2From:find(row,"Slot 2 From"),slot2To:find(row,"Slot 2 To"),active:true};
          if(old)Object.assign(old,store); else state.stores.push(store);
          count++;
        });
        if(!count)throw new Error("No valid store rows were found. Include DS Code and DS Name columns.");
        save(); setMessage(`${count} store${count===1?"":"s"} imported.`);
      }
      function importOrders(text: string): void {
        const rows=parseCsv(text);
        if(rows.length<2)throw new Error("The file needs a header row and at least one order.");
        const header=rows[0].map(norm);
        const get=(row: string[],...names: string[]): string => {const index=names.map(name=>header.indexOf(norm(name))).find(i=>i>=0);return index==null?"":row[index]||"";};
        let count=0;
        rows.slice(1).forEach(row=>{
          const code=get(row,"DS Code","Store code","Code");
          const store=state.stores.find(item=>item.code.toLowerCase()===code.toLowerCase());
          if(!store)return;
          const slot=String(get(row,"Slot")||"1")==="2"?2:1;
          const entry={frozen:number(get(row,"Frozen","Frozen pallets")),chilled:number(get(row,"Chilled","Chilled pallets")),ambient:number(get(row,"Ambient","Ambient pallets"))};
          state.orders[`${store.id}:${slot}`]=entry;count++;
        });
        if(!count)throw new Error("No orders imported. Match a store code and include Frozen, Chilled and/or Ambient columns.");
        save();setMessage(`${count} order row${count===1?"":"s"} imported.`);
      }
      function writeClipboard(text: string): Promise<void> {
        if(navigator.clipboard && window.isSecureContext)return navigator.clipboard.writeText(text);
        const input=document.createElement("textarea");input.value=text;input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();
        const copied=document.execCommand("copy");input.remove();
        return copied?Promise.resolve():Promise.reject(new Error("Clipboard access is unavailable."));
      }
      function tripText(trip: PlannedTrip): string {
        return [`${trip.truck} — Trip ${trip.number}`,`Driver: ${state.trucks.find(t=>t.id===trip.truckId)?.driver||"—"}`,`${trip.depart} depart · ${trip.returnAt} return`,...trip.stops.map((stop,i)=>`${i+1}. ${stop.store} · ${stop.arrive} · ${stop.load} pallets (${stop.items.map(item=>`${item.count} ${item.type}`).join(", ")})`),`Route: ${trip.mapUrl}`].join("\n");
      }
      function samplePlan(): void {
        const samples=[
          ["CAIDS33","Cairo Festival City","30.0300, 31.4080","21:00","02:00","00:30","03:00"],
          ["CAIDS40","Nasr City","30.0610, 31.3430","21:00","02:00","",""],
          ["CAIDS21","Maadi","29.9602, 31.2569","22:00","03:00","",""],
          ["CAIDS12","Sheikh Zayed","30.0131, 30.9750","23:00","03:00","",""],
          ["CAIDS55","New Cairo","30.0074, 31.4913","00:30","04:00","",""]
        ];
        state.settings.warehouseLocation="29.9380, 30.9140";
        state.stores=samples.map(([code,name,location,slot1From,slot1To,slot2From,slot2To])=>({id:crypto.randomUUID(),code,name,location,coords:parseLocation(location),slot1From,slot1To,slot2From,slot2To,active:true}));
        state.trucks=[
          {id:crypto.randomUUID(),plate:"TRK 104",type:"reefer",capacity:12,driver:"Ahmed Hassan",phone:"+20 100 123 4567"},
          {id:crypto.randomUUID(),plate:"TRK 208",type:"reefer",capacity:10,driver:"Mona Ali",phone:"+20 100 234 5678"},
          {id:crypto.randomUUID(),plate:"TRK 315",type:"dry",capacity:14,driver:"Omar Samir",phone:"+20 100 345 6789"}
        ];
        state.availability={};state.orders={};
        const quantities=[
          [2,1,4,0,0,0],[0,0,5,0,0,0],[1,0,3,0,0,0],[0,2,2,0,0,0],[0,0,6,0,0,0]
        ];
        state.stores.forEach((store,index)=>{
          const q=quantities[index];
          state.orders[`${store.id}:1`]={frozen:q[0],chilled:q[1],ambient:q[2]};
          state.orders[`${store.id}:2`]={frozen:q[3],chilled:q[4],ambient:q[5]};
        });
        const totals=allOrderTotals();
        state.pallets={frozen:totals.frozen,chilled:totals.chilled,ambient:totals.ambient};
        buildPlan();save();currentTab="routes";message="Sample data is loaded. Replace it with your own stores and orders whenever you’re ready.";render();
      }
      function escapeId(id: string): string { return String(id).replace(/["\\]/g,"\\$&"); }
      document.addEventListener("click",event=>{
        if (!(event.target instanceof Element)) return;
        if (event.target.closest("#languageToggle")) {
          language = language === "ar" ? "en" : "ar";
          try {
            localStorage.setItem(LANGUAGE_KEY, language);
          } catch (error) {
            console.error("Could not save the language preference.", error);
          }
          render();
          return;
        }
        const tab=event.target.closest<HTMLElement>("[data-tab]");
        if(tab && isTabName(tab.dataset.tab)){currentTab=tab.dataset.tab;message="";render();return;}
        const actionElement=event.target.closest<HTMLElement>("[data-action]");
        if(actionElement){
          event.preventDefault();
          const action=actionElement.dataset.action;
          if(action==="go-fleet")currentTab="fleet";
          else if(action==="go-stores")currentTab="stores";
          else if(action==="go-settings")currentTab="settings";
          else if(action==="go-today")currentTab="today";
          else if(action==="sample"){samplePlan();return;}
          else if(action==="plan"){buildPlan();currentTab="routes";message="";render();return;}
          else if(action==="clear-orders"){
            if (window.confirm(translateText("Clear all store orders for this shift?"))){state.orders={};state.plan=null;save();render();}
            return;
          } else if(action==="copy-day"){
            const previous=state.ordersByDate?.[previousDate(state.date)];
            if(!previous){setMessage("No saved orders were found for the previous day.");return;}
            state.orders=clone(previous);save();markOutdated();render();setMessage("Copied the previous day’s orders.");
          } else if(action==="template"){
            const headers=["DS Code","DS Name","Slot","Frozen","Chilled","Ambient"];
            const example=state.stores.length?state.stores.flatMap(store=>[1,2].map(slot=>[store.code,store.name,slot,0,0,0])):[["CAIDS33","Store name",1,0,0,0]];
            download("dispatch-orders-template.csv",[headers,...example].map(row=>row.map(csvCell).join(",")).join("\r\n"));
          } else if(action==="import-orders")document.getElementById("ordersFile")?.click();
          else if(action==="import-stores")document.getElementById("storesFile")?.click();
          else if(action==="upload-logo")document.getElementById("logoFile")?.click();
          else if(action==="export-plan"){
            if(!state.plan)return;
            const rows: Array<Array<string | number>>=[["Truck","Trip","Mode","Depart","Return","Store","Arrival","Slot","Frozen","Chilled","Ambient","Pallets","Distance km"]];
            state.plan.trips.forEach(trip=>trip.stops.forEach(stop=>{
              const item={frozen:0,chilled:0,ambient:0};stop.items.forEach(part=>item[part.type]+=part.count);
              rows.push([trip.truck,trip.number,trip.mode,trip.depart,trip.returnAt,stop.store,stop.arrive,stop.slot,item.frozen,item.chilled,item.ambient,stop.load,trip.km.toFixed(1)]);
            }));
            download(`dispatch-plan-${state.date}.csv`,rows.map(row=>row.map(csvCell).join(",")).join("\r\n"));
          } else if(action==="copy-all"){
            const plan=state.plan;
            if(plan)writeClipboard(plan.trips.map(tripText).join("\n\n")).then(()=>setMessage("All driver run sheets copied."),error=>setMessage(error.message,true));
          } else if(action==="copy-trip"){
            const tripIndex=Number(actionElement.dataset.trip);
            const trip=Number.isInteger(tripIndex)?state.plan?.trips[tripIndex]:undefined;
            if(trip)writeClipboard(tripText(trip)).then(()=>setMessage("Run sheet copied."),error=>setMessage(error.message,true));
          }
          render();return;
        }
        const delStore=event.target.closest<HTMLElement>("[data-delete-store]");
        if(delStore){
          const id=delStore.dataset.deleteStore;
          if(!id)return;
          const store=state.stores.find(item=>item.id===id);
          if(store && window.confirm(translateText(`Delete ${store.name}?`))){state.stores=state.stores.filter(item=>item.id!==id);Object.keys(state.orders).filter(key=>key.startsWith(`${id}:`)).forEach(key=>delete state.orders[key]);markOutdated();save();render();}
          return;
        }
        const delTruck=event.target.closest<HTMLElement>("[data-delete-truck]");
        if(delTruck){
          const id=delTruck.dataset.deleteTruck;
          if(!id)return;
          const truck=state.trucks.find(item=>item.id===id);
          if(truck && window.confirm(translateText(`Delete truck ${truck.plate}?`))){state.trucks=state.trucks.filter(item=>item.id!==id);delete state.availability[id];markOutdated();save();render();}
        }
      });
      function previousDate(date: string): string {const d=new Date(date+"T12:00:00");d.setDate(d.getDate()-1);return localDateString(d);}
      function markOutdated(): void {if(state.plan)state.plan.outdated=true;}
      document.addEventListener("input",event=>{
        if (!(event.target instanceof HTMLInputElement)) return;
        const target=event.target;
        if(target.id==="shiftDate"){
          state.ordersByDate=state.ordersByDate||{};
          state.ordersByDate[state.date]=clone(state.orders);
          state.date=target.value||state.date;
          state.orders=clone(state.ordersByDate[state.date]||{});
          state.plan=null;save();render();return;
        }
        if(target.dataset.order){
          const [storeId,slotValue,typeValue]=target.dataset.order.split(":");
          if(!storeId || !isProductType(typeValue) || (slotValue!=="1" && slotValue!=="2"))return;
          const slot=Number(slotValue);
          const type=typeValue;
          const key=`${storeId}:${slot}`;
          state.orders[key]=state.orders[key]||{frozen:0,chilled:0,ambient:0};
          state.orders[key][type]=number(target.value);state.ordersByDate=state.ordersByDate||{};state.ordersByDate[state.date]=clone(state.orders);
          markOutdated();save();const totals=allOrderTotals();
          const productTypes: ProductType[]=["frozen","chilled","ambient"];
          document.querySelectorAll<HTMLElement>(".order-totals .pill").forEach((pill,index)=>{const type=productTypes[index];if(type)pill.innerHTML=`<strong>${translateText(type[0].toUpperCase()+type.slice(1))}</strong> ${totals[type]} ${translateText("ordered")}`;});
          return;
        }
        if(target.dataset.pallet){
          if(!isProductType(target.dataset.pallet))return;
          state.pallets[target.dataset.pallet]=number(target.value);markOutdated();save();return;
        }
        if(isSettingKey(target.dataset.setting)){
          const key=target.dataset.setting;
          if(key==="warehouseName" || key==="warehouseLocation" || key==="shiftStart" || key==="shiftEnd") {
            state.settings[key]=target.value;
          } else {
            const value=number(target.value);
            if(key==="loadMinutes")state.settings.loadMinutes=value;
            else if(key==="stopMinutes")state.settings.stopMinutes=value;
            else if(key==="palletMinutes")state.settings.palletMinutes=value;
            else if(key==="maxTrips")state.settings.maxTrips=value;
            else if(key==="roadFactor")state.settings.roadFactor=value;
            else if(key==="planningEffort")state.settings.planningEffort=value;
          }
          markOutdated();save();
          if(key==="warehouseName")document.getElementById("warehouseSubtitle")!.textContent=translateText(`${state.settings.warehouseName} · Ambient + Frozen/Chilled`);
          if(key==="warehouseLocation"){
            const line=target.closest(".card")?.querySelector(".notice-line");
            if(line)line.textContent=translateText(parseLocation(target.value)?"Location set":"Location missing");
          }
          return;
        }
        if(target.dataset.speedTime!=null){state.settings.speeds[Number(target.dataset.speedTime)].until=target.value;markOutdated();save();return;}
        if(target.dataset.speedValue!=null){state.settings.speeds[Number(target.dataset.speedValue)].speed=number(target.value);markOutdated();save();}
      });
      document.addEventListener("change",event=>{
        if (!(event.target instanceof HTMLInputElement)) return;
        const target=event.target;
        if(target.dataset.availability){state.availability[target.dataset.availability]=target.checked;target.closest(".truck-toggle")?.classList.toggle("off",!target.checked);markOutdated();save();}
        if(target.dataset.storeActive){const store=state.stores.find(item=>item.id===target.dataset.storeActive);if(store){store.active=target.checked;markOutdated();save();}}
        if(target.id==="ordersFile"||target.id==="storesFile"){
          const file=target.files?.[0];if(!file)return;
          const reader=new FileReader();
          reader.onload=()=>{
            try{
              if(target.id==="ordersFile")importOrders(String(reader.result||""));
              else importStores(String(reader.result||""));
              render();
            }catch(error){setMessage(error instanceof Error ? error.message : "Could not import this file.",true);}
            target.value="";
          };
          reader.onerror=()=>setMessage("Could not read the selected file.",true);
          reader.readAsText(file);
        }
        if(target.id==="logoFile"){
          const file=target.files?.[0];if(!file)return;
          if(file.size>2*1024*1024){setMessage("Please choose a logo smaller than 2 MB.",true);target.value="";return;}
          const reader=new FileReader();reader.onload=()=>{state.settings.logo=String(reader.result||"");save();render();};reader.onerror=()=>setMessage("Could not read the logo file.",true);reader.readAsDataURL(file);
        }
      });
      document.addEventListener("submit",event=>{
        if (!(event.target instanceof HTMLFormElement)) return;
        const form=event.target;
        if(form.id==="storeForm"){
          event.preventDefault();
          const code=formValue(form,"code"),name=formValue(form,"name"),location=formValue(form,"location");
          if(state.stores.some(store=>store.code.toLowerCase()===code.trim().toLowerCase())){setMessage("A store with this code already exists.",true);return;}
          const store: Store={id:crypto.randomUUID(),code:code.trim(),name:name.trim(),location:location.trim(),coords:parseLocation(location),slot1From:formValue(form,"slot1From"),slot1To:formValue(form,"slot1To"),slot2From:formValue(form,"slot2From"),slot2To:formValue(form,"slot2To"),active:true};
          state.stores.push(store);markOutdated();save();render();setMessage("Store added.");
        }
        if(form.id==="truckForm"){
          event.preventDefault();
          const plate=formValue(form,"plate"),type=formValue(form,"type");
          if(state.trucks.some(truck=>truck.plate.toLowerCase()===plate.trim().toLowerCase())){setMessage("A truck with this number already exists.",true);return;}
          const truck: Truck={id:crypto.randomUUID(),plate:plate.trim(),type:type==="dry"?"dry":"reefer",capacity:number(formValue(form,"capacity")),driver:formValue(form,"driver").trim(),phone:formValue(form,"phone").trim()};
          state.trucks.push(truck);markOutdated();save();render();setMessage("Truck added.");
        }
      });
      function formValue(form: HTMLFormElement, name: string): string {
        const field=form.elements.namedItem(name);
        return field instanceof HTMLInputElement || field instanceof HTMLSelectElement ? field.value : "";
      }
      render();
    })();
