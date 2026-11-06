import { z } from 'zod';
export const options = {
  interestedIn: ['Nutrition & Food', 'Health Care & Fitness', 'Ayurveda & Herbal', 'Good Living & Lifestyle'],
  boothType: ['Shell Scheme', 'Discuss with the team'],
  boothSize: ['9 sq. m', '18 sq. m', '27 sq. m', '36 sq. m', 'Custom / Discuss with the team'],
  stallNo: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'H12', 'H13', 'H14', 'H15', 'H16', 'H17', 'H18', 'H19', 'H20']
};
export const assignmentKeys = ['interestedIn', 'boothType', 'boothSize', 'stallNo'];
export const labels = {
 interestedIn: 'Interested to Participate In', boothType: 'Booth Type', boothSize: 'Booth Size',stallNo: 'Stall Number', businessNature: 'Describe Your Business Nature', facia: 'Facia Name', GSTNumber: 'GST Number', website: 'Website Link', fullName: 'Full Name', companyName: 'Company Name', email: 'Email', contactNumber: 'Contact Number', country: 'Country', designation: 'Designation', city: 'City', specialRequirements: 'Special Requirements', additionalMessage: 'Additional Message', consent: 'Consent'
};
const required = (name, max = 120) => z.string().trim().min(2, `${name} must contain at least 2 characters.`).max(max, `${name} is too long.`).refine(s => !/[\r\n]/.test(s), 'Please use a single line.');
const choice = z.string().trim().min(1, 'Please choose an option.').max(120);
export const registrationSchema = z.object({
 interestedIn: choice, boothType: choice, boothSize: choice, stallNo: choice,
 businessNature: z.string().trim().min(10, 'Please describe your business in at least 10 characters.').max(2000),
 facia: z.string().trim().min(2, 'Please enter a valid facia name.').max(100),
 GSTNumber: z.string().trim().max(20, 'Please enter a valid GST number.').optional().default(''),
 website: z.string().trim().max(300).refine(v => { if (!v) return true; try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } }, 'Enter a full website URL beginning with https://.'),
 fullName: required('Full name'), companyName: required('Company name',200),
 email: z.email('Enter a valid email address.').max(254),
 contactNumber: z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/, 'Enter a valid contact number.').refine(v => { const n=v.replace(/\D/g,'').length; return n>=7 && n<=15; }, 'Use 7 to 15 digits, including country code.'),
 country: required('Country'), designation: required('Designation'), city: required('City'),
 specialRequirements: z.string().trim().max(2000), additionalMessage: z.string().trim().max(3000),
 consent: z.literal(true, { error: 'Please provide consent before submitting.' }),
 companyFax: z.string().max(0, 'Invalid submission.').optional().default('')
}).strict();
export const completionSchema = registrationSchema.omit({
 interestedIn: true, boothType: true, boothSize: true, stallNo: true
});
export function fieldErrors(error) { return Object.fromEntries(error.issues.map(i => [String(i.path[0]), i.message])); }
