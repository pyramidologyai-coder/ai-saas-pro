"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processIncomingMessage = void 0;
var generative_ai_1 = require("@google/generative-ai");
var supabase_1 = require("./supabase");
var genAI = new generative_ai_1.GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyBwb26YF603BDmGLK7M0Wyq3Ka-OzASp4s');
/**
 * Advanced Generic AI Processing for Multi-tenant SaaS
 */
var processIncomingMessage = function (message_1, tenantId_1) {
    var args_1 = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args_1[_i - 2] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([message_1, tenantId_1], args_1, true), void 0, function (message, tenantId, history, customerPhone) {
        var tenant, items, itemsInfo, branches, branchesInfo, upcomingBookingsText, userBookings, bookingsList, model, businessContext, workingHours, customPrompt, today_1, next7Days, systemInstruction, formattedHistory, _a, history_1, h, role, lastMsg, chat, result, responseText, cleanText, responseJson, error_1;
        if (history === void 0) { history = []; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, supabase_1.supabase.from('tenants').select('*').eq('id', tenantId).single()];
                case 1:
                    tenant = (_b.sent()).data;
                    if (!tenant)
                        throw new Error('Tenant not found');
                    return [4 /*yield*/, supabase_1.supabase.from('items').select('*').eq('tenant_id', tenantId)];
                case 2:
                    items = (_b.sent()).data;
                    itemsInfo = items === null || items === void 0 ? void 0 : items.map(function (i) { return "".concat(i.name, " (").concat(i.price, " \u062C.\u0645)"); }).join(', ');
                    return [4 /*yield*/, supabase_1.supabase.from('branches').select('name, location').eq('tenant_id', tenantId)];
                case 3:
                    branches = (_b.sent()).data;
                    branchesInfo = '';
                    if (branches && branches.length > 0) {
                        branchesInfo = "\u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062A\u0627\u062D\u0629: ".concat(branches.map(function (b) { return "".concat(b.name, " (").concat(b.location || '', ")"); }).join('، '), ". \u0625\u0630\u0627 \u0643\u0627\u0646 \u0647\u0646\u0627\u0643 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0641\u0631\u0639\u060C \u064A\u062C\u0628 \u0633\u0624\u0627\u0644 \u0627\u0644\u0639\u0645\u064A\u0644 \u0639\u0646 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0630\u064A \u064A\u0641\u0636\u0644\u0647 \u0644\u0644\u062D\u062C\u0632 \u0625\u0630\u0627 \u0644\u0645 \u064A\u062D\u062F\u062F\u0647.");
                    }
                    upcomingBookingsText = 'هذا العميل (ليس لديه) أي حجوزات مسجلة حالياً في النظام.';
                    if (!customerPhone) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('bookings')
                            .select('*')
                            .eq('tenant_id', tenantId)
                            .eq('customer_phone', customerPhone)
                            .gte('booking_time', new Date().toISOString())
                            .order('booking_time', { ascending: true })];
                case 4:
                    userBookings = (_b.sent()).data;
                    if (userBookings && userBookings.length > 0) {
                        bookingsList = userBookings.map(function (b) { return "".concat(b.customer_name, " - ").concat(b.service_name, " (\u064A\u0648\u0645 ").concat(new Date(b.booking_time).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }), ")"); }).join('، ');
                        upcomingBookingsText = "\u0647\u0630\u0627 \u0627\u0644\u0639\u0645\u064A\u0644 \u0644\u062F\u064A\u0647 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0628\u0627\u0633\u0645\u0647: [".concat(bookingsList, "].");
                    }
                    _b.label = 5;
                case 5:
                    console.log('--- DEBUG: upcomingBookingsText ---');
                    console.log(upcomingBookingsText);
                    console.log('------------------------------------');
                    model = genAI.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        generationConfig: { responseMimeType: "application/json" }
                    });
                    businessContext = tenant.type === 'clinic'
                        ? "\u0623\u0646\u062A \u0645\u0648\u0638\u0641 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0630\u0643\u064A \u0641\u064A \u0639\u064A\u0627\u062F\u0629 \"".concat(tenant.name, "\".")
                        : "\u0623\u0646\u062A \u0645\u0633\u0627\u0639\u062F \u0630\u0643\u064A \u0641\u064A \u0645\u0637\u0639\u0645 \"".concat(tenant.name, "\".");
                    workingHours = tenant.working_hours || 'من السبت للخميس، من 2 ظهراً لـ 10 مساءً';
                    customPrompt = tenant.custom_prompt ? "\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0645\u0646 \u0627\u0644\u0625\u062F\u0627\u0631\u0629: ".concat(tenant.custom_prompt) : '';
                    today_1 = new Date();
                    next7Days = Array.from({ length: 7 }).map(function (_, i) {
                        var d = new Date(today_1);
                        d.setDate(today_1.getDate() + i);
                        var dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'Africa/Cairo' }).format(d);
                        var dateStr = d.toISOString().split('T')[0];
                        return "".concat(dayName, " (").concat(dateStr, ")");
                    }).join('، ');
                    systemInstruction = "\n      ".concat(businessContext, " \n      \u0647\u062F\u0641\u0644\u0643 \u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0628\u0644\u0647\u062C\u0629 \u0645\u0635\u0631\u064A\u0629 \u0648\u062F\u0648\u062F\u0629 \u062C\u062F\u0627\u064B \u0648\u0628\u062F\u0648\u0646 \u062A\u0643\u0644\u0641.\n      \u062A\u062D\u0630\u064A\u0631 \u0647\u0627\u0645 \u062C\u062F\u0627\u064B: \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \u0623\u064A \u0639\u0628\u0627\u0631\u0627\u062A \u062A\u0631\u062D\u064A\u0628 (\u0645\u062B\u0644 \u0623\u0647\u0644\u0627\u064B \u0628\u0643\u060C \u0625\u0632\u064A\u0643\u060C \u0646\u0648\u0631\u062A\u0646\u0627\u060C \u0625\u0644\u062E) \u0646\u0647\u0627\u0626\u064A\u0627\u064B. \u0627\u062F\u062E\u0644 \u0641\u064A \u0635\u0644\u0628 \u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0648\u0645\u0628\u0627\u0634\u0631\u0629 \u0641\u064A \u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u064A\u0644.\n      \u0627\u0644\u064A\u0648\u0645 \u0647\u0648: ").concat(new Intl.DateTimeFormat('ar-EG', { weekday: 'long', timeZone: 'Africa/Cairo' }).format(today_1), ".\n      \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062D\u0627\u0644\u064A: ").concat(today_1.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' }), ".\n      \u062F\u0644\u064A\u0644 \u062A\u0648\u0627\u0631\u064A\u062E \u0627\u0644\u0623\u064A\u0627\u0645 \u0627\u0644\u0640 7 \u0627\u0644\u0642\u0627\u062F\u0645\u0629 (\u0627\u0633\u062A\u062E\u062F\u0645\u0647 \u062D\u0635\u0631\u0627\u064B \u0644\u0645\u0639\u0631\u0641\u0629 \u0627\u0644\u062A\u0648\u0627\u0631\u064A\u062E): ").concat(next7Days, ".\n      \u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0639\u0645\u0644: ").concat(workingHours, ".\n      \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0648\u0623\u0633\u0639\u0627\u0631\u0647\u0627: [").concat(itemsInfo, "].\n      ").concat(branchesInfo, "\n      \n      \u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u0645\u0624\u0643\u062F\u0629 \u0644\u0644\u0639\u0645\u064A\u0644: ").concat(upcomingBookingsText, "\n      \u0645\u0644\u0627\u062D\u0638\u0629 \u0647\u0627\u0645\u0629 \u062C\u062F\u0627\u064B: \u0644\u0627 \u062A\u062E\u0628\u0631 \u0627\u0644\u0639\u0645\u064A\u0644 \u0628\u062D\u0627\u0644\u0629 \u062D\u062C\u0648\u0632\u0627\u062A\u0647 (\u0633\u0648\u0627\u0621 \u0639\u0646\u062F\u0647 \u062D\u062C\u0648\u0632\u0627\u062A \u0623\u0648 \u0644\u0627) **\u0625\u0644\u0627 \u0625\u0630\u0627 \u0633\u0623\u0644 \u0647\u0648 \u0628\u0646\u0641\u0633\u0647 \u0639\u0646\u0647\u0627**. \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0639\u0645\u064A\u0644 \u064A\u0637\u0644\u0628 \u062D\u062C\u0632\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B\u060C \u0631\u0643\u0632 \u0641\u0642\u0637 \u0639\u0644\u0649 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u062C\u062F\u064A\u062F \u0648\u062A\u062C\u0627\u0647\u0644 \u0630\u0643\u0631 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629 \u062A\u0645\u0627\u0645\u0627\u064B. \u0627\u0633\u062A\u062E\u062F\u0645 \u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A\u0643 \u0641\u0642\u0637.\n      ").concat(customPrompt, "\n\n      \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u062F\u0643 \u0628\u062A\u0646\u0633\u064A\u0642 JSON \u062D\u0635\u0631\u0627\u064B \u0643\u0627\u0644\u062A\u0627\u0644\u064A:\n      {\n        \"reply\": \"\u0646\u0635 \u0627\u0644\u0631\u062F \u0628\u0627\u0644\u0639\u0627\u0645\u064A\u0629 \u0627\u0644\u0645\u0635\u0631\u064A\u0629\",\n        \"intent\": \"book\" \u0623\u0648 \"chat\" \u0623\u0648 \"inquire\" \u0623\u0648 \"cancel\",\n        \"bookings\": [\n          {\n            \"customerName\": \"\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 \u0644\u0648 \u0630\u0643\u0631\u0647\",\n            \"serviceName\": \"\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629\",\n            \"branchName\": \"\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0630\u064A \u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631\u0647 (\u0641\u0642\u0637 \u0625\u0630\u0627 \u0630\u0643\u0631\u0647 \u0627\u0644\u0639\u0645\u064A\u0644\u060C \u0648\u0625\u0644\u0627 \u0627\u062A\u0631\u0643\u0647 \u0641\u0627\u0631\u063A\u0627\u064B)\",\n            \"bookingTime\": \"\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0635\u064A\u063A\u0629 ISO 8601 \u0645\u0639 \u0625\u0636\u0627\u0641\u0629 \u0641\u0631\u0642 \u0627\u0644\u062A\u0648\u0642\u064A\u062A \u0644\u0645\u0635\u0631 +03:00 \u062F\u0627\u0626\u0645\u0627\u064B (\u0645\u062B\u0627\u0644: 2026-04-27T17:00:00+03:00). \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \u062D\u0631\u0641 Z \u0623\u0628\u062F\u0627\u064B.\"\n          }\n        ]\n      }\n      \n      \u062A\u062D\u0630\u064A\u0631\u0627\u062A \u0647\u0627\u0645\u0629 \u062C\u062F\u0627\u064B (\u0627\u0644\u062A\u0632\u0645 \u0628\u0647\u0627 \u062D\u0631\u0641\u064A\u0627\u064B):\n      1. \u0645\u0635\u0641\u0648\u0641\u0629 \"bookings\" \u0641\u064A \u0627\u0644\u0640 JSON: (\u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0641\u0627\u0631\u063A\u0629 \u062A\u0645\u0627\u0645\u0627\u064B []) \u0625\u0644\u0627 \u0641\u064A \u062D\u0627\u0644\u0629 \u0648\u0627\u062D\u062F\u0629 \u0641\u0642\u0637: \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0639\u0645\u064A\u0644 (\u064A\u0637\u0644\u0628 \u062D\u062C\u0632\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B \u0627\u0644\u0622\u0646). \u0625\u064A\u0627\u0643 \u0623\u0646 \u062A\u0636\u0639 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629 \u0623\u0648 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u0635\u0641\u0648\u0641\u0629 \u0623\u0628\u062F\u0627\u064B\u060C \u0644\u0623\u0646 \u0648\u0636\u0639\u0647\u0627 \u0633\u064A\u062C\u0639\u0644 \u0627\u0644\u0646\u0638\u0627\u0645 \u064A\u0643\u0631\u0631 \u062D\u062C\u0632\u0647\u0627 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649!\n      2. \u0644\u0627 \u062A\u0642\u0645 \u0628\u062A\u0623\u0644\u064A\u0641 \u0623\u0648 \u062A\u062E\u0645\u064A\u0646 \u0623\u0648 \u062A\u0648\u0632\u064A\u0639 \u0645\u0648\u0627\u0639\u064A\u062F \u0645\u0646 \u062A\u0644\u0642\u0627\u0621 \u0646\u0641\u0633\u0643 \u0623\u0628\u062F\u0627\u064B.\n      3. \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629\u060C \u0627\u0633\u0623\u0644 \u0627\u0644\u0639\u0645\u064A\u0644 \u0639\u0646 \u0627\u0644\u0646\u0627\u0642\u0635.\n      4. \u0625\u0630\u0627 \u0633\u0623\u0644 \u0627\u0644\u0639\u0645\u064A\u0644 \"\u0647\u0644 \u0644\u064A \u062D\u062C\u0648\u0632\u0627\u062A\u061F\"\u060C \u0627\u062C\u0639\u0644 intent = \"inquire\" \u0648\u0627\u062A\u0631\u0643 \u0645\u0635\u0641\u0648\u0641\u0629 bookings \u0641\u0627\u0631\u063A\u0629 \u062A\u0645\u0627\u0645\u0627\u064B [].\n      5. \u0625\u0630\u0627 \u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u064A\u0644 \u0625\u0644\u063A\u0627\u0621 \u062D\u062C\u0632\u0647\u060C \u0627\u062C\u0639\u0644 intent = \"cancel\" \u0648\u0631\u062F \u0628\u0623\u0633\u0644\u0648\u0628 \u0644\u0628\u0642.\n    ");
                    formattedHistory = [];
                    for (_a = 0, history_1 = history; _a < history_1.length; _a++) {
                        h = history_1[_a];
                        role = h.sender === 'incoming' ? 'user' : 'model';
                        lastMsg = formattedHistory[formattedHistory.length - 1];
                        if (lastMsg && lastMsg.role === role) {
                            lastMsg.parts[0].text += '\n' + h.text;
                        }
                        else {
                            formattedHistory.push({
                                role: role,
                                parts: [{ text: h.text }]
                            });
                        }
                    }
                    chat = model.startChat({
                        history: __spreadArray([
                            { role: 'user', parts: [{ text: "System Instructions: " + systemInstruction }] },
                            { role: 'model', parts: [{ text: "مفهوم، سألتزم بالتعليمات وتنسيق JSON." }] }
                        ], formattedHistory, true)
                    });
                    return [4 /*yield*/, chat.sendMessage(message)];
                case 6:
                    result = _b.sent();
                    responseText = result.response.text();
                    cleanText = responseText.replace(/```json\n/g, '').replace(/```/g, '').trim();
                    responseJson = JSON.parse(cleanText);
                    return [2 /*return*/, {
                            intent: responseJson.intent || 'chat',
                            replyMessage: responseJson.reply || responseJson.replyMessage || responseJson.text || 'عذراً، لم أتمكن من فهم رسالتك بوضوح.',
                            bookings: responseJson.bookings || (responseJson.bookingDetails ? [responseJson.bookingDetails] : [])
                        }];
                case 7:
                    error_1 = _b.sent();
                    console.error('Gemini/DB Error:', error_1);
                    return [2 /*return*/, {
                            intent: 'chat',
                            replyMessage: 'أهلاً بك يا فندم! معلش حصل ضغط بسيط عندي، ممكن حضرتك تكرر رسالتك؟'
                        }];
                case 8: return [2 /*return*/];
            }
        });
    });
};
exports.processIncomingMessage = processIncomingMessage;
