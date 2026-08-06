"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
try {
    (0, app_1.initializeApp)({
        projectId: 'vamos-jogar-31b9b'
    });
}
catch (e) { }
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
