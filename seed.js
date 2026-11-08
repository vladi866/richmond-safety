// STARTER LIBRARIES - have your JOSH committee review against company procedures + WorkSafeBC before use.
const SC=["Install hoistway scaffold / platform",[
["Inspect materials, set up work area","Slips, trips, dropped objects","Clear landing, barricade below, hard hat"],
["Install ledgers / brackets at landing","Fall from open hoistway","Harness tied to rated anchor, guardrails"],
["Lay planks / platform decking","Pinch points, unsecured deck","Secure and cleat planks, inspect deck"],
["Install toe boards and guardrails","Falling tools or materials","Toe boards, tool lanyards, tool bags"],
["Inspect and tag scaffold","Using an unsafe scaffold","Competent person inspection, green tag"]]];
const CM=[
["Fall protection in hoistway",["Inspect harness and lanyard before every use; tie off to a rated anchor before opening any hoistway door","No open-edge work without guardrail or personal fall arrest; rescue plan reviewed"]],
["Lockout / tagout",["Lock and tag every energy source, test for zero energy; only the lock owner removes it","Use a group lock box on multi-trade jobs; verify by attempting a start"]],
["Housekeeping",["Keep landings, pits and walkways clear; bag debris; nothing stored at hoistway openings","Clean as you go and sweep at end of shift; remove tripping hazards"]],
["Ladders",["Inspect ladder, keep 3-point contact, tie off or foot it, extend 3 ft above landing","Never carry tools in hands while climbing; use a belt or hoist line"]],
["Manual material handling",["Use hoist, cart or team lift for heavy items; keep back straight and plan the route","Break loads down; ask for help over safe lifting limits"]],
["Hot work and welding",["Hot work permit, fire watch, extinguisher at hand, fire blanket over open shaft","Clear combustibles from the area; keep fire watch after finishing"]],
["Hand and power tool safety",["Inspect cords and guards, use GFCI, right tool for the task","Disconnect before changing bits or blades; no modified tools"]],
["PPE",["Hard hat, glasses, safety boots, gloves and hi-vis worn at all times on site","Inspect PPE for damage and replace worn items"]],
["Silica and drilling anchors",["Wet-drill or use vacuum attachment; respirator and eye protection","Clean dust with HEPA vacuum, no dry sweeping"]],
["Electrical safety",["Treat all wires as live until tested with a rated meter","Lock out and test before touching; keep cords off wet floors"]],
["Working alone / check-in",["Agree check-in times, supervisor knows location, phone charged","No solo work in hoistway or machine room without check-in"]],
["Heat and cold stress",["Water breaks, shade, rotate tasks; watch for dizziness and cramps","Dress in layers, warm breaks in cold; keep gloves dry"]],
["WHMIS and chemicals",["Read the SDS, label all containers, correct gloves and ventilation","Store solvents and oils in approved containers; spill kit available"]],
["First aid and emergency procedures",["Know the first aid attendant, muster point and nearest exit","Review the rescue plan; report all injuries and near misses right away"]],
["Dropped objects and overhead work",["Barricade the landing below, use tool lanyards and bags, hard hats on","Toe boards on platforms; never work above others without protection"]]];
const HS=[
["Pit entry and access",["Check pit light, stop switch and ladder before entry; 3-point access","Keep the pit dry; pump out water before working"]],
["Hydraulic oil and spills",["Clean spills at once with absorbent and report leaks; mark slip hazards","Gloves and eye protection; dispose of oil in approved containers"]],
["Pressurized hydraulic lines",["Depressurize and lock out the pump unit before opening fittings","Never check for leaks with hands; use cardboard and a face shield"]],
["Pump unit and machine room",["Lock out main disconnect; keep room clear and lit","Hot oil: let the unit cool before servicing"]],
["Jack and cylinder rigging",["Rated rigging, spotter, clear drop zone; never stand under a load","Brace the cylinder until anchored and plumbed"]],
["Cab blocking and mechanical stops",["Block the cab with rated stands before working under it","Set pit mechanical stops before any pit work"]],
["Rail installation",["Secure rail before releasing the hoist; keep hands clear of pinch points","Two-person guide for long rails; gloves"]],
["Hoistway doors and openings",["Barricade every open door frame; replace barricade if removed","Install door frames only while tied off"]],
["Low-rise scaffolding and platforms",["Inspect scaffold before use; secure planks, guardrails and toe boards","Competent person tags scaffold; no overloading"]],
["Grinding and cutting",["Face shield and glasses, guards in place, secure the workpiece","Control sparks and remove flammables"]]];
const TS=[
["Counterweight handling",["Block and secure the counterweight; never stand beneath it","Communicate before any movement; use rated pins and chains"]],
["Working on car top",["Stop switch first, 3-point contact, keep clear of the counterweight","Barricade open door; inspection mode only; do not lean past the car edge"]],
["Machine room and traction machine",["Lock out main power, secure the sheave, stay clear of moving ropes","Use rated rigging to set the machine; keep room clear"]],
["Rigging and hoisting",["Inspect slings, shackles and chain falls; verify load rating; use tag lines","Clear the area below; one designated signaler"]],
["Ropes and sheaves",["Keep hands and clothing away from ropes and sheaves in motion","Lock out before servicing; wear gloves"]],
["Governor and safeties",["Test only with lockout and a trained person; keep clear of pinch points","Never bypass the safety circuit; report faults"]],
["Rail installation (high-rise)",["Plumb lines secured, tied off on the platform, gloves on","Hoist rails with rated gear and tag line; barricade below"]],
["Multi-level scaffold / platform",["Inspect each shift; guardrails and toe boards; tagged by competent person","Never exceed rated load; secure planks"]],
["Cab assembly and installation",["Rated rigging and cribbing; harness tied off during frame assembly","Two-person lifts for panels; cut-resistant gloves"]],
["Travelling cable and wiring",["Lock out before pulling cable; protect from sharp edges","Support the cable weight; keep hands clear of the bend"]]];
const SEED={v:2,
tb:{H:[...CM,...HS],T:[...CM,...TS]},
jha:{H:{[SC[0]]:SC[1],
"Install jack and cylinder (pit)":[
["Prepare pit and lighting","Water, slips, poor light","Pump out and clean pit, LED lighting"],
["Rig and lower cylinder","Crush, dropped load","Rated rigging, spotter, clear drop zone"],
["Set and plumb cylinder","Pinch points, strain","Two-person lift, gloves, bracing"],
["Connect piping and fittings","Oil spray, skin contact","Depressurize, gloves, face shield"],
["Fill oil and leak test","Slips, pressurized oil","Absorbent on hand, check fittings, stay clear"]]},
T:{[SC[0]]:SC[1],
"Install cab (traction)":[
["Set up cab sling and platform","Heavy load, crush","Rated rigging, cribbing under platform"],
["Assemble cab frame","Pinch points, falls","Harness tied off, gloves"],
["Install walls and ceiling panels","Cuts, strains","Cut-resistant gloves, two-person lifts"],
["Hang cab on ropes / rails","Moving car, crushing","Lockout, signaler, barricade landings"],
["Final check and clean-up","Trips, debris","Housekeeping, remove all materials"]]}}};
