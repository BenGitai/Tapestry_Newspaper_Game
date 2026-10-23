// AI-CONTENT-REVIEW: generic fictional news for the demo. The story templates
// and name lists below were written by an AI model as placeholders (approved for
// the demo only). Every event, person and organization is invented; real
// neighborhoods and teams appear for flavor only. The full game replaces this
// with real wire news, plus generated local sports and politics.
//
// Generation is deterministic: the same day always produces the same stories.
// Every number and name in a story's text also appears in its facts.
import type { Category, CityWorld, Story } from './schemas.ts';

type Rand = () => number;

function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Alicia', 'Brendan', 'Carmen', 'Darnell', 'Elena', 'Gloria', 'Hector', 'Ingrid', 'Jamal', 'Katrina', 'Leon', 'Monica', 'Nathan', 'Olivia', 'Pedro', 'Quinn', 'Renee', 'Simone', 'Terrence', 'Ursula', 'Victor', 'Wendy', 'Xavier', 'Yvette', 'Zachary'];
const LAST = ['Abara', 'Bellamy', 'Castellano', 'Dombrowski', 'Ellison', 'Fairweather', 'Galloway', 'Hargrove', 'Ibarra', 'Jankowski', 'Kessler', 'Lombardi', 'Marchetti', 'Nakamura', 'Oduya', 'Pruitt', 'Quintero', 'Rasmussen', 'Szymanski', 'Talbot', 'Underwood', 'Valcourt', 'Whitcombe', 'Yablonski', 'Zeller'];

interface Ctx {
  /**
   * A number in [min, max]. Within one story the same range always gives the same
   * number, so a headline and a fact that mention the same quantity agree.
   */
  n(min: number, max: number): number;
  pick<T>(xs: readonly T[]): T;
  name(): string;
  last(): string;
  /** A neighborhood in the story's first district. */
  hood: string;
  /** The story's first district name. */
  district: string;
  money(min: number, max: number): string;
  num(v: number): string;
}

interface Template {
  cat: Category;
  sub: string;
  imp: [number, number];
  inches: [number, number];
  /** How a Hard-hitting take moves perceived lean (-1 left .. +1 right). */
  lean?: number;
  targets?: string[];
  sensitivity?: 'high';
  scope?: Story['scope'];
  /** 'city' = every district, 'none' = no district. */
  where?: 'one' | 'two' | 'city' | 'none';
  photo: string;
  make: (c: Ctx) => { h: string; f: string[] };
}

const T: Template[] = [
  // ---------------- politics ----------------
  { cat: 'politics', sub: 'council', imp: [3, 5], inches: [10, 14], lean: -0.25, targets: ['city_hall'], photo: 'Council chamber, empty seats', make: (c) => { const v = c.n(9, 13); return { h: `Council votes ${v}-${17 - v} to cut rec center hours`, f: [`City Council voted ${v}-${17 - v} to cut weekend hours at ${c.n(6, 14)} recreation centers.`, `The cut saves an estimated ${c.money(1, 4)} a year.`, `Residents of ${c.hood} testified against the plan for ${c.n(2, 4)} hours.`] }; } },
  { cat: 'politics', sub: 'council', imp: [2, 4], inches: [8, 12], lean: 0.25, targets: ['city_hall'], photo: 'City Hall tower at dusk', make: (c) => { const name = c.name(); return { h: `Councilmember wants audit of city vehicle fleet`, f: [`Councilmember ${name} introduced a bill calling for an independent audit of the city's vehicle fleet.`, `The city owns about ${c.num(c.n(5, 7) * 1000)} vehicles, according to the bill.`, `${name} said ${c.n(300, 700)} vehicles were driven fewer than 1,000 miles last year.`, `A committee hearing has not been scheduled.`] }; } },
  { cat: 'politics', sub: 'council', imp: [1, 3], inches: [6, 8], photo: 'Ribbon cutting outside a branch office', make: (c) => ({ h: `Council approves new street names in ${c.hood}`, f: [`City Council approved renaming ${c.n(2, 4)} blocks in ${c.hood} after longtime community volunteers.`, `The measure passed without opposition.`, `New signs are expected within ${c.n(3, 8)} weeks.`] }) },
  { cat: 'politics', sub: 'elections', imp: [2, 4], inches: [8, 12], lean: 0.2, targets: ['city_hall'], photo: 'Stack of voter registration forms', make: (c) => ({ h: `Turnout in special election falls to ${c.n(9, 15)} percent`, f: [`Turnout in a special election for a state House seat in the ${c.district} was ${c.n(9, 15)} percent, election officials said.`, `${c.n(6, 12)} polling places were consolidated before the vote.`, `The winner, ${c.name()}, received ${c.num(c.n(3, 7) * 1000 + c.n(0, 999))} votes.`] }) },
  { cat: 'politics', sub: 'elections', imp: [2, 3], inches: [8, 10], lean: -0.2, photo: 'Campaign yard signs on a rowhouse block', make: (c) => ({ h: `Ward leaders split over open council seat`, f: [`Ward leaders in the ${c.district} have endorsed ${c.n(2, 3)} different candidates for an open City Council seat.`, `The filing deadline is in ${c.n(3, 6)} weeks.`, `One candidate, ${c.name()}, has raised about ${c.num(c.n(40, 180) * 1000)} dollars.`] }) },
  { cat: 'politics', sub: 'elections', imp: [1, 3], inches: [6, 8], photo: 'Line of voters outside a school gym', make: (c) => ({ h: `City adds ${c.n(8, 20)} mail ballot drop boxes`, f: [`The city election office will add ${c.n(8, 20)} mail ballot drop boxes before the next election.`, `The boxes will be placed at libraries and recreation centers.`, `The office said ${c.n(30, 45)} percent of voters used mail ballots last time.`] }) },
  { cat: 'politics', sub: 'policy', imp: [3, 5], inches: [10, 14], lean: 0.3, targets: ['city_hall'], photo: 'Budget binders on a conference table', make: (c) => ({ h: `City proposes ${c.n(2, 5)} percent property tax increase`, f: [`The mayor's office proposed a ${c.n(2, 5)} percent increase in the property tax rate.`, `The increase would raise about ${c.money(30, 80)} a year for schools and pensions.`, `The median homeowner would pay about ${c.n(60, 190)} dollars more per year, officials said.`, `City Council must approve the plan.`] }) },
  { cat: 'politics', sub: 'policy', imp: [3, 4], inches: [10, 12], lean: -0.3, targets: ['city_hall'], photo: 'Construction cranes over a riverfront lot', make: (c) => ({ h: `Developer tax break would cost city ${c.money(20, 60)}, analysis finds`, f: [`A tax abatement for a riverfront project would cost the city about ${c.money(20, 60)} over ${c.n(10, 20)} years, according to an analysis by the city controller.`, `The project would include ${c.n(200, 600)} apartments.`, `The developer said the project cannot be built without the abatement.`] }) },
  { cat: 'politics', sub: 'policy', imp: [2, 3], inches: [8, 10], photo: 'Trash trucks lined up in a depot', make: (c) => ({ h: `Twice-weekly trash pickup to expand to ${c.n(3, 6)} more neighborhoods`, f: [`The city will expand twice-weekly trash pickup to ${c.n(3, 6)} more neighborhoods, including ${c.hood}.`, `The expansion costs about ${c.money(2, 6)} a year.`, `It begins in ${c.n(4, 10)} weeks.`] }) },
  { cat: 'politics', sub: 'state_federal', imp: [3, 4], inches: [8, 12], lean: -0.25, scope: 'national', where: 'city', photo: 'State capitol dome', make: (c) => ({ h: `State budget deal trims transit aid by ${c.n(4, 9)} percent`, f: [`A state budget agreement cuts operating aid for public transit by ${c.n(4, 9)} percent.`, `The Philadelphia region's share of the cut is about ${c.money(15, 45)}.`, `Lawmakers said the savings would fund road repairs.`] }) },
  { cat: 'politics', sub: 'state_federal', imp: [2, 4], inches: [8, 10], lean: 0.25, scope: 'national', where: 'city', photo: 'Federal building entrance', make: (c) => ({ h: `Federal audit questions city's use of ${c.money(10, 30)} in relief funds`, f: [`A federal audit said the city could not document how it spent ${c.money(10, 30)} in pandemic relief funds.`, `The audit reviewed ${c.n(40, 90)} contracts.`, `City officials said the paperwork exists and will be provided.`] }) },
  { cat: 'politics', sub: 'courts', imp: [3, 4], inches: [10, 12], lean: 0.2, targets: ['city_hall'], photo: 'Courthouse steps', make: (c) => ({ h: `Court backlog reaches ${c.num(c.n(11, 16) * 1000)} cases`, f: [`The county court system has a backlog of about ${c.num(c.n(11, 16) * 1000)} criminal cases, according to a court report.`, `The median case now takes ${c.n(14, 22)} months to resolve.`, `The courts have ${c.n(8, 15)} judicial vacancies.`] }) },
  { cat: 'politics', sub: 'courts', imp: [2, 3], inches: [8, 10], lean: -0.2, photo: 'Gavel on a wooden bench', make: (c) => ({ h: `Judge orders city to reopen eviction diversion records`, f: [`A judge ordered the city to release records about its eviction diversion program.`, `The program handled about ${c.num(c.n(3, 8) * 1000)} cases last year.`, `A tenants' group, which filed the suit, said ${c.n(20, 40)} percent of cases ended without an agreement.`] }) },

  // ---------------- economy ----------------
  { cat: 'economy', sub: 'jobs', imp: [3, 5], inches: [10, 12], lean: -0.2, photo: 'Warehouse loading dock', make: (c) => ({ h: `Distribution center to cut ${c.n(150, 400)} jobs in ${c.district}`, f: [`A distribution center in the ${c.district} will cut ${c.n(150, 400)} jobs over the next ${c.n(2, 4)} months, according to a state layoff notice.`, `The company cited lower shipping volume.`, `Workers will receive ${c.n(4, 10)} weeks of severance, the notice said.`] }) },
  { cat: 'economy', sub: 'jobs', imp: [2, 4], inches: [8, 10], photo: 'Hard hats on a training site', make: (c) => ({ h: `Apprenticeship program doubles to ${c.n(200, 400)} trainees`, f: [`A construction apprenticeship program will grow to ${c.n(200, 400)} trainees next year.`, `About ${c.n(60, 80)} percent of past trainees found jobs within a year, the program said.`, `It is funded by a ${c.money(2, 6)} state grant.`] }) },
  { cat: 'economy', sub: 'jobs', imp: [3, 4], inches: [8, 12], lean: 0.2, photo: 'Hospital service entrance', make: (c) => ({ h: `Hospital workers vote to authorize strike`, f: [`Service workers at a ${c.district} hospital voted to authorize a strike.`, `The union represents about ${c.n(600, 1400)} workers.`, `The vote was ${c.n(85, 97)} percent in favor.`, `No strike date has been set.`] }) },
  { cat: 'economy', sub: 'real_estate', imp: [2, 4], inches: [8, 12], lean: -0.25, targets: ['penn_treaty_dev'], photo: 'Rowhouses with a SOLD sign', make: (c) => ({ h: `Rents in ${c.hood} up ${c.n(9, 18)} percent in a year`, f: [`Average asking rents in ${c.hood} rose ${c.n(9, 18)} percent over the past year, according to a housing report.`, `The citywide increase was ${c.n(3, 6)} percent.`, `Penn Treaty Development Group owns ${c.n(4, 9)} buildings in the area.`] }) },
  { cat: 'economy', sub: 'real_estate', imp: [2, 3], inches: [8, 10], lean: 0.2, targets: ['city_hall'], photo: 'Vacant lot with a zoning notice', make: (c) => ({ h: `Zoning delays stall ${c.n(12, 30)} housing projects, builders say`, f: [`Builders say ${c.n(12, 30)} housing projects are waiting on zoning decisions.`, `The projects would add about ${c.num(c.n(8, 20) * 100)} homes.`, `The zoning board said it has added ${c.n(1, 3)} hearing days per month.`] }) },
  { cat: 'economy', sub: 'small_business', imp: [1, 3], inches: [6, 10], targets: ['mariners_hardware'], photo: 'Corner hardware store window', make: (c) => ({ h: `${c.hood} merchants report ${c.n(10, 20)} percent sales drop during road work`, f: [`Merchants on a commercial corridor in ${c.hood} reported sales down ${c.n(10, 20)} percent during ${c.n(3, 7)} months of road work.`, `Mariner's Hardware said foot traffic fell by about a third.`, `The city said the work will finish in ${c.n(2, 6)} weeks.`] }) },
  { cat: 'economy', sub: 'small_business', imp: [1, 2], inches: [6, 8], photo: 'Bakery counter with trays of rolls', make: (c) => ({ h: `${c.n(20, 60)}-year-old ${c.pick(['bakery', 'tailor shop', 'luncheonette', 'shoe repair shop'])} to close`, f: [`A family-run business in ${c.hood} will close at the end of the month after ${c.n(20, 60)} years.`, `The owners, ${c.name()} and family, said they are retiring.`, `The building has been sold.`] }) },
  { cat: 'economy', sub: 'small_business', imp: [2, 3], inches: [8, 10], lean: -0.15, targets: ['city_hall'], photo: 'Storefront with a FOR LEASE sign', make: (c) => ({ h: `Storefront grant program runs out of money in ${c.n(3, 8)} weeks`, f: [`A city storefront improvement grant program ran out of money ${c.n(3, 8)} weeks after opening.`, `It awarded ${c.n(80, 160)} grants of up to ${c.num(c.n(5, 15) * 1000)} dollars.`, `About ${c.n(200, 400)} applications are on a waiting list.`] }) },
  { cat: 'economy', sub: 'small_business', imp: [2, 4], inches: [8, 10], lean: 0.2, targets: ['city_hall'], photo: 'Shop owner flipping an OPEN sign', make: (c) => ({ h: `Business group says new leave rule will cost small firms ${c.money(10, 30)}`, f: [`A business association said a proposed city paid-leave rule would cost small firms about ${c.money(10, 30)} a year.`, `The rule would cover businesses with ${c.n(5, 15)} or more employees.`, `Supporters said about ${c.num(c.n(40, 90) * 1000)} workers lack paid leave.`] }) },
  { cat: 'economy', sub: 'transit', imp: [3, 4], inches: [8, 12], targets: ['transit_authority'], where: 'city', photo: 'Trolley at a downtown stop', make: (c) => ({ h: `Trolley line closes for ${c.n(4, 9)} months of track work`, f: [`The Philadelphia Transit Authority will close a trolley line for ${c.n(4, 9)} months of track replacement.`, `Shuttle buses will replace the service.`, `The project costs ${c.money(40, 90)}.`] }) },
  { cat: 'economy', sub: 'transit', imp: [2, 3], inches: [8, 10], targets: ['transit_authority'], photo: 'Bus with an OUT OF SERVICE sign', make: (c) => ({ h: `${c.n(12, 25)} percent of buses late last month, report says`, f: [`About ${c.n(12, 25)} percent of buses arrived late last month, according to a transit authority report.`, `The authority said it is short ${c.n(80, 200)} drivers.`, `A new driver class of ${c.n(30, 60)} starts next month.`] }) },
  { cat: 'economy', sub: 'finance', imp: [2, 3], inches: [8, 10], lean: -0.2, targets: ['schuylkill_savings'], photo: 'Bank branch with shuttered windows', make: (c) => ({ h: `Schuylkill Savings to close ${c.n(3, 6)} branches`, f: [`Schuylkill Savings Bank will close ${c.n(3, 6)} branches, including one in ${c.hood}.`, `The bank said ${c.n(70, 85)} percent of transactions now happen online.`, `No layoffs are planned, the bank said.`] }) },
  { cat: 'economy', sub: 'finance', imp: [2, 3], inches: [8, 10], lean: 0.2, targets: ['city_hall'], photo: 'Pension report on a desk', make: (c) => ({ h: `City pension fund ${c.n(55, 68)} percent funded, actuaries say`, f: [`The city's pension fund is ${c.n(55, 68)} percent funded, according to an annual actuarial report.`, `The fund earned ${c.n(4, 9)} percent last year.`, `The city's required contribution rises by ${c.money(20, 60)} next year.`] }) },

  // ---------------- social ----------------
  { cat: 'social', sub: 'education', imp: [3, 4], inches: [10, 12], lean: 0.15, targets: ['city_hall'], photo: 'School hallway with lockers', make: (c) => ({ h: `${c.n(18, 30)} school buildings need major repairs, survey finds`, f: [`A facilities survey found ${c.n(18, 30)} school buildings need major repairs.`, `The estimated cost is ${c.money(200, 600)}.`, `The district said repairs would be prioritized by safety.`] }) },
  { cat: 'social', sub: 'education', imp: [2, 3], inches: [8, 10], lean: -0.15, photo: 'Students walking into a school', make: (c) => ({ h: `${c.district} schools short ${c.n(40, 90)} teachers`, f: [`Schools in the ${c.district} have ${c.n(40, 90)} teaching vacancies, according to district figures.`, `Substitutes are covering ${c.n(60, 85)} percent of the open positions.`, `The district plans a hiring fair next month.`] }) },
  { cat: 'social', sub: 'education', imp: [1, 2], inches: [6, 8], photo: 'Spelling bee stage', make: (c) => ({ h: `${c.hood} student wins citywide spelling bee`, f: [`An eighth grader from ${c.hood} won the citywide spelling bee after ${c.n(14, 22)} rounds.`, `${c.n(40, 70)} students competed.`, `The winner advances to the state bee.`] }) },
  { cat: 'social', sub: 'education', imp: [2, 4], inches: [8, 10], lean: 0.2, targets: ['city_hall'], photo: 'Classroom with stacked chairs', make: (c) => ({ h: `Charter school waitlists top ${c.num(c.n(20, 35) * 1000)} students`, f: [`Waitlists for the city's charter schools total about ${c.num(c.n(20, 35) * 1000)} students, according to a charter group.`, `${c.n(3, 6)} charter applications are pending before the school board.`, `The district said new charters would cost it about ${c.money(20, 50)} a year.`] }) },
  { cat: 'social', sub: 'health', imp: [3, 4], inches: [8, 10], sensitivity: 'high', photo: 'Clinic waiting room, empty chairs', make: (c) => ({ h: `Flu hospitalizations rise ${c.n(20, 45)} percent in two weeks`, f: [`Flu hospitalizations in the city rose ${c.n(20, 45)} percent over two weeks, the health department said.`, `The department reported ${c.n(3, 9)} flu-related deaths this season.`, `Free vaccine clinics will run at ${c.n(10, 20)} recreation centers.`] }) },
  { cat: 'social', sub: 'health', imp: [2, 3], inches: [8, 10], lean: -0.2, photo: 'Pharmacy counter', make: (c) => ({ h: `Last pharmacy in ${c.hood} to close`, f: [`The only pharmacy in ${c.hood} will close next month.`, `The nearest pharmacy will be about ${c.n(2, 3)} miles away, residents said.`, `About ${c.num(c.n(4, 9) * 1000)} people live within a mile of the store.`] }) },
  { cat: 'social', sub: 'housing', imp: [2, 4], inches: [8, 12], lean: -0.25, photo: 'Apartment building with a code violation notice', make: (c) => ({ h: `Inspectors cite ${c.n(40, 120)} violations at ${c.hood} apartment complex`, f: [`City inspectors cited ${c.n(40, 120)} code violations at an apartment complex in ${c.hood}.`, `The violations include broken heat and water leaks, the inspection report said.`, `The owner has ${c.n(30, 60)} days to make repairs.`] }) },
  { cat: 'social', sub: 'housing', imp: [2, 3], inches: [8, 10], lean: 0.2, targets: ['city_hall'], photo: 'Rowhouse with boarded windows', make: (c) => ({ h: `Home repair program waitlist hits ${c.n(3, 6)} years`, f: [`The wait for a city home repair grant has reached about ${c.n(3, 6)} years.`, `About ${c.num(c.n(5, 12) * 1000)} homeowners are on the list.`, `The program fixed ${c.num(c.n(8, 20) * 100)} homes last year.`] }) },
  { cat: 'social', sub: 'safety', imp: [3, 4], inches: [8, 10], sensitivity: 'high', photo: 'Fire engine on a rowhouse block at night (no people shown)', make: (c) => ({ h: `${c.n(2, 4)} injured in ${c.hood} rowhouse fire`, f: [`${c.n(2, 4)} people were injured in a rowhouse fire in ${c.hood}, the fire department said.`, `Firefighters had the fire under control in about ${c.n(20, 45)} minutes.`, `The cause is under investigation.`] }) },
  { cat: 'social', sub: 'safety', imp: [2, 4], inches: [8, 12], lean: 0.25, targets: ['city_hall'], photo: 'Police cruiser parked on a corner', make: (c) => ({ h: `Car break-ins up ${c.n(15, 35)} percent in ${c.district}`, f: [`Reported car break-ins in the ${c.district} rose ${c.n(15, 35)} percent this year, according to police data.`, `There were ${c.num(c.n(9, 20) * 100)} reports through last month.`, `Police said they have added ${c.n(2, 6)} patrol shifts.`] }) },
  { cat: 'social', sub: 'safety', imp: [2, 3], inches: [6, 10], lean: -0.2, sensitivity: 'high', photo: 'Crosswalk with fresh paint', make: (c) => ({ h: `${c.n(9, 18)} pedestrians killed this year, city traffic report says`, f: [`${c.n(9, 18)} pedestrians have been killed in traffic crashes this year, according to a city report.`, `The report identifies ${c.n(10, 25)} high-injury corridors.`, `The city plans new crosswalks and speed cushions on ${c.n(4, 8)} of them.`] }) },
  { cat: 'social', sub: 'community', imp: [1, 2], inches: [6, 8], photo: 'Volunteers at a food pantry table', make: (c) => ({ h: `${c.hood} food pantry serves record ${c.n(400, 900)} families`, f: [`A food pantry in ${c.hood} served ${c.n(400, 900)} families last month, a record.`, `Volunteers said demand has risen for ${c.n(3, 8)} straight months.`, `The pantry is open ${c.n(2, 4)} days a week.`] }) },
  { cat: 'social', sub: 'community', imp: [1, 2], inches: [6, 8], photo: 'Block party with folding tables', make: (c) => ({ h: `${c.hood} block wins citywide cleanup contest`, f: [`A block in ${c.hood} won the citywide block cleanup contest.`, `${c.n(60, 140)} blocks entered.`, `The prize is ${c.num(c.n(1, 5) * 1000)} dollars for planters and trees.`] }) },

  // ---------------- sports ----------------
  { cat: 'sports', sub: 'baseball', imp: [2, 3], inches: [8, 10], where: 'city', photo: 'Empty ballpark seats in the off-season', make: (c) => ({ h: `Phillies sign reliever to ${c.n(2, 3)}-year deal`, f: [`The Phillies signed a right-handed reliever to a ${c.n(2, 3)}-year contract.`, `The deal is worth about ${c.money(8, 20)}, a source familiar with the deal said.`, `He posted a ${c.n(2, 3)}.${c.n(10, 99)} earned run average last season.`] }) },
  { cat: 'sports', sub: 'baseball', imp: [1, 2], inches: [6, 8], photo: 'Youth baseball field', make: (c) => ({ h: `${c.hood} youth league gets new field lights`, f: [`A youth baseball league in ${c.hood} will get new field lights.`, `The project costs ${c.num(c.n(80, 200) * 1000)} dollars, paid by a team charity.`, `About ${c.n(200, 500)} children play in the league.`] }) },
  { cat: 'sports', sub: 'football', imp: [3, 4], inches: [8, 12], where: 'city', photo: 'Football on a muddy field', make: (c) => { const us = c.n(20, 34); return { h: `Eagles beat division rival ${us}-${us - c.n(3, 10)}`, f: [`The Eagles beat a division rival ${us}-${us - c.n(3, 10)} at home.`, `The quarterback threw for ${c.n(210, 340)} yards and ${c.n(2, 3)} touchdowns.`, `The team is now ${c.n(6, 9)}-${c.n(2, 4)}.`] }; } },
  { cat: 'sports', sub: 'football', imp: [2, 3], inches: [8, 10], where: 'city', photo: 'Trainer taping an ankle', make: (c) => ({ h: `Eagles lose starting cornerback for ${c.n(4, 8)} weeks`, f: [`The Eagles' starting cornerback will miss ${c.n(4, 8)} weeks with a hamstring injury, the team said.`, `He has ${c.n(2, 5)} interceptions this season.`, `A rookie will start in his place.`] }) },
  { cat: 'sports', sub: 'basketball', imp: [2, 3], inches: [8, 10], where: 'city', photo: 'Basketball hoop, net swaying', make: (c) => { const us = c.n(98, 124); return { h: `Sixers win ${us}-${us - c.n(2, 15)} behind ${c.n(30, 42)}-point night`, f: [`The Sixers won ${us}-${us - c.n(2, 15)} at home.`, `Their center scored ${c.n(30, 42)} points.`, `The team has won ${c.n(3, 6)} straight games.`] }; } },
  { cat: 'sports', sub: 'basketball', imp: [1, 3], inches: [6, 8], where: 'city', photo: 'Empty arena after a game', make: (c) => ({ h: `Sixers drop ${c.n(3, 5)}th straight`, f: [`The Sixers lost their ${c.n(3, 5)}th straight game.`, `They shot ${c.n(38, 43)} percent from the field.`, `The coach said the team's defense has to improve.`] }) },
  { cat: 'sports', sub: 'hockey', imp: [1, 3], inches: [6, 8], where: 'city', photo: 'Hockey puck on fresh ice', make: (c) => ({ h: `Flyers win in overtime, ${c.n(3, 4)}-${c.n(2, 3)}`, f: [`The Flyers won ${c.n(3, 4)}-${c.n(2, 3)} in overtime.`, `Their goalie made ${c.n(28, 41)} saves.`, `The game drew ${c.num(c.n(17, 19) * 1000 + c.n(0, 999))} fans.`] }) },
  { cat: 'sports', sub: 'hockey', imp: [1, 2], inches: [6, 8], photo: 'Outdoor rink being flooded', make: (c) => ({ h: `Outdoor rink in ${c.hood} to open early`, f: [`An outdoor skating rink in ${c.hood} will open ${c.n(1, 3)} weeks early this season.`, `Skate rentals will cost ${c.n(3, 6)} dollars.`, `The rink drew about ${c.num(c.n(10, 30) * 1000)} visits last winter.`] }) },
  { cat: 'sports', sub: 'soccer', imp: [2, 3], inches: [6, 10], where: 'city', photo: 'Soccer ball on a penalty spot', make: (c) => ({ h: `Union advance on penalty kicks`, f: [`The Union advanced in the playoffs after a ${c.n(1, 2)}-${c.n(1, 2)} draw, winning on penalty kicks.`, `The keeper saved ${c.n(2, 3)} penalties.`, `The next round is on the road.`] }) },
  { cat: 'sports', sub: 'soccer', imp: [1, 2], inches: [6, 8], photo: 'Kids chasing a ball on a city field', make: (c) => ({ h: `Free youth soccer clinics expand to ${c.n(6, 12)} parks`, f: [`Free youth soccer clinics will expand to ${c.n(6, 12)} city parks, including one in ${c.hood}.`, `About ${c.num(c.n(1, 3) * 1000)} children signed up last year.`, `Clinics run on weekends.`] }) },
  { cat: 'sports', sub: 'college', imp: [1, 3], inches: [6, 8], photo: 'High school football bleachers', make: (c) => ({ h: `${c.hood} high school wins first league title in ${c.n(12, 40)} years`, f: [`A public high school in ${c.hood} won its first football league title in ${c.n(12, 40)} years.`, `The final score was ${c.n(21, 35)}-${c.n(7, 20)}.`, `Senior running back ${c.name()} ran for ${c.n(120, 240)} yards.`] }) },
  { cat: 'sports', sub: 'college', imp: [1, 2], inches: [6, 8], where: 'city', photo: 'College gym during a scrimmage', make: (c) => ({ h: `City college teams open season ranked in top ${c.n(20, 25)}`, f: [`${c.n(2, 3)} Philadelphia college basketball teams opened the season ranked in a national top ${c.n(20, 25)}.`, `It is the first time in ${c.n(5, 12)} years that more than one city team is ranked.`, `The teams meet in ${c.n(3, 8)} weeks.`] }) },

  // ---------------- culture ----------------
  { cat: 'culture', sub: 'music', imp: [1, 2], inches: [6, 8], photo: 'Small stage with a drum kit', make: (c) => ({ h: `${c.hood} jazz club reopens after ${c.n(2, 5)} years`, f: [`A jazz club in ${c.hood} reopened after being closed for ${c.n(2, 5)} years.`, `The new owners spent ${c.num(c.n(200, 600) * 1000)} dollars on renovations.`, `It will host live music ${c.n(4, 6)} nights a week.`] }) },
  { cat: 'culture', sub: 'music', imp: [1, 3], inches: [6, 8], where: 'city', photo: 'Orchestra chairs on an empty stage', make: (c) => ({ h: `Orchestra musicians reach ${c.n(3, 4)}-year contract`, f: [`Orchestra musicians and management reached a ${c.n(3, 4)}-year contract.`, `It includes raises of ${c.n(2, 4)} percent a year.`, `The season will go on as planned.`] }) },
  { cat: 'culture', sub: 'food', imp: [1, 2], inches: [6, 8], targets: ['passyunk_eats'], photo: 'Plates on a restaurant pass', make: (c) => ({ h: `Restaurant group opens ${c.n(2, 3)} spots in ${c.hood}`, f: [`Passyunk Eats Restaurant Group opened ${c.n(2, 3)} restaurants in ${c.hood}.`, `The group now runs ${c.n(9, 14)} restaurants in the city.`, `It hired about ${c.n(60, 120)} workers for the new locations.`] }) },
  { cat: 'culture', sub: 'food', imp: [1, 2], inches: [6, 8], photo: 'Line outside a cheesesteak window', make: (c) => ({ h: `${c.hood} sandwich shop marks ${c.n(50, 80)} years`, f: [`A sandwich shop in ${c.hood} is celebrating ${c.n(50, 80)} years in business.`, `It is run by the third generation of the same family.`, `The shop will sell sandwiches at ${c.n(1950, 1975)} prices for one day.`] }) },
  { cat: 'culture', sub: 'arts', imp: [1, 2], inches: [6, 8], photo: 'Gallery wall with framed prints', make: (c) => ({ h: `Museum show features ${c.n(40, 90)} works by city artists`, f: [`A new museum exhibition features ${c.n(40, 90)} works by Philadelphia artists.`, `It runs for ${c.n(3, 5)} months.`, `Admission will be free on ${c.n(1, 2)} Sundays a month.`] }) },
  { cat: 'culture', sub: 'arts', imp: [1, 3], inches: [6, 8], lean: -0.15, targets: ['city_hall'], photo: 'Theater marquee with missing letters', make: (c) => ({ h: `Arts grants cut ${c.n(10, 25)} percent in city budget`, f: [`City grants to arts groups were cut ${c.n(10, 25)} percent in the new budget.`, `About ${c.n(120, 250)} groups received grants last year.`, `The city said the cut saves ${c.money(1, 3)}.`] }) },
  { cat: 'culture', sub: 'film', imp: [1, 2], inches: [6, 8], photo: 'Film crew lights on a rowhouse block', make: (c) => ({ h: `TV series to film in ${c.hood} for ${c.n(6, 12)} weeks`, f: [`A television series will film in ${c.hood} for ${c.n(6, 12)} weeks.`, `The production expects to hire about ${c.n(150, 300)} local crew members.`, `Some streets will close on filming days.`] }) },
  { cat: 'culture', sub: 'film', imp: [1, 2], inches: [6, 8], where: 'city', photo: 'Empty cinema seats', make: (c) => ({ h: `Film festival sells ${c.num(c.n(20, 40) * 1000)} tickets`, f: [`The city's film festival sold ${c.num(c.n(20, 40) * 1000)} tickets, organizers said.`, `It screened ${c.n(90, 160)} films.`, `About ${c.n(20, 35)} percent were by local filmmakers.`] }) },
  { cat: 'culture', sub: 'heritage', imp: [1, 2], inches: [6, 8], photo: 'Historic marker on a brick wall', make: (c) => ({ h: `Historic marker honors ${c.hood} labor organizer`, f: [`A state historic marker was unveiled in ${c.hood} honoring a labor organizer from the 1930s.`, `About ${c.n(80, 200)} people attended the ceremony.`, `It is the ${c.n(3, 8)}th marker added in the neighborhood.`] }) },
  { cat: 'culture', sub: 'heritage', imp: [1, 2], inches: [6, 8], lean: 0.15, targets: ['city_hall'], photo: 'Old church with scaffolding', make: (c) => ({ h: `Historic church in ${c.hood} faces demolition`, f: [`A church built in the ${c.n(1860, 1910)}s in ${c.hood} could be demolished after an engineering report.`, `Repairs would cost about ${c.money(3, 8)}.`, `The city historical commission will review the case.`] }) },

  // ---------------- science & tech ----------------
  { cat: 'science', sub: 'medicine', imp: [2, 4], inches: [8, 10], targets: ['helix_forge'], photo: 'Lab pipettes in a rack', make: (c) => ({ h: `Helix Forge drug enters final trial stage`, f: [`Helix Forge Therapeutics said a drug for a rare liver disease entered its final stage of clinical trials.`, `The trial will enroll about ${c.n(300, 700)} patients.`, `Results are expected in ${c.n(2, 3)} years.`] }) },
  { cat: 'science', sub: 'medicine', imp: [2, 3], inches: [8, 10], photo: 'Hospital corridor', make: (c) => ({ h: `Study: ER wait times ${c.n(25, 50)} percent longer than five years ago`, f: [`Emergency room wait times in the region are ${c.n(25, 50)} percent longer than five years ago, a university study found.`, `The median wait is now ${c.n(3, 5)} hours.`, `The study reviewed ${c.n(1, 3)} million visits.`] }) },
  { cat: 'science', sub: 'climate', imp: [2, 3], inches: [8, 10], lean: -0.2, targets: ['city_hall'], photo: 'Flooded underpass after rain', make: (c) => ({ h: `${c.district} streets flooded ${c.n(6, 14)} times this year`, f: [`Streets in the ${c.district} flooded ${c.n(6, 14)} times this year, according to city stormwater data.`, `That is up from ${c.n(2, 5)} times five years ago.`, `A drainage project is planned but not funded.`] }) },
  { cat: 'science', sub: 'climate', imp: [2, 3], inches: [8, 10], lean: 0.2, photo: 'Solar panels on a school roof', make: (c) => ({ h: `City solar program ${c.n(20, 40)} percent over budget`, f: [`A program to put solar panels on city buildings is ${c.n(20, 40)} percent over budget, according to a controller's review.`, `Panels have been installed on ${c.n(12, 30)} of ${c.n(40, 60)} planned buildings.`, `Officials said equipment costs rose.`] }) },
  { cat: 'science', sub: 'tech', imp: [1, 3], inches: [6, 8], photo: 'Coworking space with laptops', make: (c) => ({ h: `Startup raises ${c.money(4, 15)} for delivery robots`, f: [`A Philadelphia startup raised ${c.money(4, 15)} to build sidewalk delivery robots.`, `It plans to test ${c.n(10, 30)} robots in ${c.hood}.`, `The company has ${c.n(15, 40)} employees.`] }) },
  { cat: 'science', sub: 'tech', imp: [1, 2], inches: [6, 8], photo: 'Library computer lab', make: (c) => ({ h: `Free public Wi-Fi expands to ${c.n(8, 20)} more blocks`, f: [`Free public Wi-Fi will expand to ${c.n(8, 20)} more blocks in ${c.hood}.`, `About ${c.n(20, 35)} percent of households there lack home internet, the city said.`, `The expansion costs ${c.num(c.n(300, 900) * 1000)} dollars.`] }) },
  { cat: 'science', sub: 'research', imp: [1, 3], inches: [6, 8], photo: 'Microscope on a lab bench', make: (c) => ({ h: `University lab wins ${c.money(5, 20)} grant to study river health`, f: [`A university lab won a ${c.money(5, 20)} federal grant to study water quality in the Schuylkill and Delaware rivers.`, `The study will run for ${c.n(4, 6)} years.`, `It will place ${c.n(20, 50)} monitoring stations.`] }) },
  { cat: 'science', sub: 'research', imp: [1, 2], inches: [6, 8], photo: 'Telescope dome at night', make: (c) => ({ h: `Students' satellite to launch next year`, f: [`A small satellite built by ${c.n(20, 40)} university students will launch next year.`, `It weighs about ${c.n(2, 4)} pounds.`, `It will measure air pollution over the region.`] }) },
  { cat: 'science', sub: 'cyber', imp: [2, 4], inches: [8, 10], targets: ['city_hall'], photo: 'Server room cabinets', make: (c) => ({ h: `Ransomware attack shuts down ${c.district} health centers' records`, f: [`A ransomware attack shut down electronic records at ${c.n(3, 6)} community health centers.`, `Staff are using paper records, the centers said.`, `About ${c.num(c.n(20, 60) * 1000)} patients are served by the centers.`] }) },
  { cat: 'science', sub: 'cyber', imp: [1, 3], inches: [6, 8], targets: ['schuylkill_savings'], photo: 'Phone showing a text alert', make: (c) => ({ h: `Bank warns of text scam after ${c.n(200, 600)} complaints`, f: [`Schuylkill Savings Bank warned customers about a text message scam.`, `The bank received about ${c.n(200, 600)} complaints in ${c.n(2, 5)} days.`, `It said it never asks for passwords by text.`] }) },

  // ---------------- world & national ----------------
  { cat: 'world', sub: 'national', imp: [2, 4], inches: [8, 10], lean: -0.2, scope: 'national', where: 'none', photo: 'Capitol building', make: (c) => ({ h: `Congress passes ${c.money(20, 60)} rail safety bill`, f: [`Congress passed a ${c.money(20, 60)} bill to upgrade rail safety equipment.`, `The bill passed ${c.n(260, 320)}-${c.n(100, 170)} in the House.`, `It requires new braking systems by ${c.n(2029, 2033)}.`] }) },
  { cat: 'world', sub: 'national', imp: [2, 4], inches: [8, 10], lean: 0.2, scope: 'national', where: 'none', photo: 'Gas station price sign', make: (c) => ({ h: `National gas prices up ${c.n(10, 30)} cents in a month`, f: [`The national average gas price rose ${c.n(10, 30)} cents in a month, according to a motorists' group.`, `The average is now ${c.n(3, 4)}.${c.n(10, 99)} dollars a gallon.`, `Analysts cited refinery maintenance.`] }) },
  { cat: 'world', sub: 'americas', imp: [1, 3], inches: [6, 8], scope: 'world', where: 'none', photo: 'Cargo ship at a container port', make: (c) => ({ h: `Canal shipping delays ease after ${c.n(3, 6)} months`, f: [`Shipping delays through a major Central American canal eased after ${c.n(3, 6)} months of low water.`, `Daily ship crossings rose to ${c.n(30, 38)}.`, `Port officials in Philadelphia expect fewer delays for imports.`] }) },
  { cat: 'world', sub: 'americas', imp: [1, 2], inches: [6, 8], scope: 'world', where: 'none', photo: 'Coffee beans drying in the sun', make: (c) => ({ h: `Coffee prices hit ${c.n(10, 20)}-year high after poor harvest`, f: [`Coffee prices reached a ${c.n(10, 20)}-year high after a poor harvest in South America.`, `Prices have risen ${c.n(30, 60)} percent this year.`, `Local cafes said they may raise prices.`] }) },
  { cat: 'world', sub: 'europe', imp: [1, 3], inches: [6, 8], scope: 'world', where: 'none', photo: 'High-speed train at a platform', make: (c) => ({ h: `European rail operators agree on single ticket system`, f: [`Rail operators in ${c.n(10, 16)} European countries agreed on a single ticketing system.`, `It is expected to launch in ${c.n(2, 4)} years.`, `About ${c.n(20, 40)} percent of cross-border trips now require multiple tickets.`] }) },
  { cat: 'world', sub: 'europe', imp: [1, 2], inches: [6, 8], scope: 'world', where: 'none', photo: 'Wind turbines offshore', make: (c) => ({ h: `North Sea wind farm sets output record`, f: [`An offshore wind farm in the North Sea produced a record ${c.n(1, 3)}.${c.n(1, 9)} gigawatts of power.`, `It has ${c.n(100, 180)} turbines.`, `The operator said it can power about ${c.n(1, 2)} million homes.`] }) },
  { cat: 'world', sub: 'africa', imp: [1, 3], inches: [6, 8], scope: 'world', where: 'none', photo: 'Solar mini-grid in a village', make: (c) => ({ h: `East African solar project reaches ${c.n(1, 3)} million homes`, f: [`A solar power program in East Africa has connected ${c.n(1, 3)} million homes, its organizers said.`, `The program began ${c.n(5, 9)} years ago.`, `It aims to reach ${c.n(4, 6)} million homes.`] }) },
  { cat: 'world', sub: 'africa', imp: [1, 2], inches: [6, 8], scope: 'world', where: 'none', photo: 'Marathon runners at a finish line', make: (c) => ({ h: `West African coastal nations sign fishing pact`, f: [`${c.n(4, 7)} West African coastal nations signed an agreement to share fishing patrols.`, `The pact covers about ${c.num(c.n(200, 500) * 1000)} square miles of ocean.`, `It takes effect next year.`] }) },
  { cat: 'world', sub: 'asia', imp: [1, 3], inches: [6, 8], scope: 'world', where: 'none', photo: 'Microchip on a fingertip', make: (c) => ({ h: `Chip shortage eases as Asian factories expand`, f: [`A shortage of computer chips is easing as factories in East Asia expand, according to an industry group.`, `Delivery times have fallen to about ${c.n(10, 16)} weeks.`, `Automakers said production will rise ${c.n(5, 12)} percent.`] }) },
  { cat: 'world', sub: 'asia', imp: [1, 2], inches: [6, 8], scope: 'world', where: 'none', photo: 'Typhoon clouds from space', make: (c) => ({ h: `Typhoon season ends with ${c.n(18, 26)} named storms`, f: [`The Pacific typhoon season ended with ${c.n(18, 26)} named storms, forecasters said.`, `That is ${c.n(1, 4)} fewer than average.`, `No storms reached the strongest category this year.`] }) },
  { cat: 'world', sub: 'middle_east', imp: [1, 3], inches: [6, 8], scope: 'world', where: 'none', photo: 'Desalination plant on a coast', make: (c) => ({ h: `Gulf states open ${c.n(2, 4)} new desalination plants`, f: [`${c.n(2, 4)} new seawater desalination plants opened in the Gulf region.`, `Together they produce about ${c.n(300, 600)} million gallons a day.`, `They run partly on solar power.`] }) },
  { cat: 'world', sub: 'middle_east', imp: [1, 2], inches: [6, 8], scope: 'world', where: 'none', photo: 'Archaeologists brushing a mosaic', make: (c) => ({ h: `Archaeologists uncover ${c.n(1500, 2200)}-year-old mosaic`, f: [`Archaeologists in the eastern Mediterranean uncovered a mosaic about ${c.n(1500, 2200)} years old.`, `It measures about ${c.n(20, 40)} feet across.`, `It will be moved to a museum.`] }) },
];

export const TEMPLATE_COUNT = T.length;

const CATEGORIES: Category[] = ['politics', 'economy', 'social', 'sports', 'culture', 'science', 'world'];
const SOURCES = ['keystone', 'dvps', 'natwire'];

/** Days with hand-written stories get a few generated extras, capped at this importance. */
const HAND_DAY_CAP = 3;

export interface GenerateOptions {
  /** How many stories to generate for the day. */
  count: number;
  /** Cap on importance (used on hand-written days so the designed headlines stay on top). */
  maxImportance?: number;
}

function fmt(v: number): string {
  return v.toLocaleString('en-US');
}

/** Generate the wire for one day. Deterministic for a given day. */
export function generateDay(world: CityWorld, day: number, opts: GenerateOptions): Story[] {
  const r = rng(0x5eed + day * 7919);
  const pick = <X,>(xs: readonly X[]): X => xs[Math.floor(r() * xs.length)]!;
  const out: Story[] = [];
  const used = new Set<number>();
  let leanSum = 0;
  // Even spread over categories, rotating which ones get the extras each day.
  const cats: Category[] = [];
  for (let i = 0; i < opts.count; i++) cats.push(CATEGORIES[(i + day) % CATEGORIES.length]!);

  cats.forEach((cat, i) => {
    const pool = T.map((t, idx) => ({ t, idx })).filter(({ t, idx }) => t.cat === cat && !used.has(idx));
    if (!pool.length) return;
    // Keep left and right lean balanced within the day, weighted by importance
    // (big stories move readers more, so they have to balance too).
    let choice = pick(pool);
    for (let tries = 0; tries < 8 && choice.t.lean && Math.sign(choice.t.lean) === Math.sign(leanSum) && Math.abs(leanSum) > 0.2; tries++) choice = pick(pool);
    used.add(choice.idx);
    const t = choice.t;

    const scope = t.scope ?? 'local';
    const where = t.where ?? (scope === 'local' ? (r() < 0.3 ? 'two' : 'one') : 'none');
    const shuffled = [...world.districts].sort(() => r() - 0.5);
    const districts = where === 'city' ? world.districts.map((d) => d.id) : where === 'none' ? [] : shuffled.slice(0, where === 'two' ? 2 : 1).map((d) => d.id);
    const home = world.districts.find((d) => d.id === districts[0]) ?? shuffled[0]!;
    const memo = new Map<string, number>();
    const n = (min: number, max: number): number => {
      const key = `${min}-${max}`;
      if (!memo.has(key)) memo.set(key, min + Math.floor(r() * (max - min + 1)));
      return memo.get(key)!;
    };
    const ctx: Ctx = {
      n,
      pick,
      name: () => `${pick(FIRST)} ${pick(LAST)}`,
      last: () => pick(LAST),
      hood: pick(home.example_neighborhoods),
      district: home.name,
      money: (min, max) => `${n(min, max)} million`,
      num: fmt,
    };
    const { h, f } = t.make(ctx);
    let importance = t.imp[0] + Math.floor(r() * (t.imp[1] - t.imp[0] + 1));
    if (opts.maxImportance) importance = Math.min(importance, opts.maxImportance);
    const minute = 5 * 60 + Math.floor(r() * 17 * 60);
    const lean = t.lean ?? 0;
    leanSum += lean * importance;
    out.push({
      id: `g${day}-${i + 1}`,
      day,
      filed_at: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      wire_source: scope === 'local' ? pick(SOURCES.slice(0, 2)) : 'natwire',
      category: t.cat,
      subtopic: t.sub,
      scope,
      districts,
      wire_headline: h,
      wire_text: f.join(' '),
      facts: f,
      importance,
      base_column_inches: t.inches[0] + Math.floor(r() * (t.inches[1] - t.inches[0] + 1)),
      sensitivity: t.sensitivity ?? 'normal',
      hard_hitting_lean: lean,
      targets: t.targets ?? [],
      tags: [t.sub, 'generated'],
      photo: `Placeholder: ${t.photo}`,
      real_story_url: '#placeholder',
    });
  });
  return out.sort((a, b) => a.filed_at.localeCompare(b.filed_at));
}

export { HAND_DAY_CAP };
